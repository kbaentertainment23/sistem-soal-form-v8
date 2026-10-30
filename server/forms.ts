import type { GoogleFormCreateRequest, GoogleFormCreateResult } from "../src/types.js";

function cleanGrade(val?: string): string {
  if (!val) return "";
  let clean = val.trim();
  clean = clean.replace(/^(kelas|tingkat|fase)\s+/gi, "").trim();
  clean = clean.replace(/^(kelas|tingkat|fase)\s+/gi, "").trim();
  return clean;
}

function cleanTitle(val?: string): string {
  if (!val) return "";
  let clean = val.trim();
  clean = clean.replace(/kelas\s+kelas\s+/gi, "Kelas ");
  clean = clean.replace(/tingkat\s+tingkat\s+/gi, "Tingkat ");
  return clean;
}

/**
 * Membersihkan nomor soal di awal teks pertanyaan (misal: "1. ", "1) ", "Soal 1: ", "**1.** ")
 * agar di Google Form hanya tampil isi soal murni tanpa nomor urut.
 */
export function stripQuestionNumber(questionText: string): string {
  if (!questionText) return "";
  let clean = questionText.trim();
  // Hapus pola awalan nomor soal seperti "1. ", "1) ", "1: ", "1 - ", "Soal 1. ", "Soal No. 1: ", "**1.** "
  clean = clean.replace(/^(?:\*\*|\*|__|_)?(?:(?:soal|nomor|no\.?)\s*\d+[\.\)\:\-\s]*|\d+[\.\)\:\-]\s*)(?:\*\*|\*|__|_)?\s*/i, "").trim();
  return clean || questionText.trim();
}

/**
 * Membersihkan label pilihan jawaban di awal teks opsi (misal: "A. ", "B) ", "(C) ", "[D] ", "**A.** ")
 * agar di Google Form pilihan jawaban tampil murni tanpa label huruf A, B, C, D.
 */
export function stripOptionPrefix(optionText: string): string {
  if (!optionText) return "";
  let clean = optionText.trim();
  // Hapus pola awalan label seperti "A. ", "A) ", "(A) ", "[A] ", "A: ", "A - ", "**A.** "
  clean = clean.replace(/^(?:\*\*|\*|__|_)?(?:\([A-Ea-e]\)|\[[A-Ea-e]\]|[A-Ea-e][\.\)\:\-])(?:\*\*|\*|__|_)?\s*/, "").trim();
  return clean || optionText.trim();
}

export async function createGoogleFormQuiz(
  accessToken: string,
  req: GoogleFormCreateRequest
): Promise<GoogleFormCreateResult> {
  if (!accessToken) {
    throw new Error("Akses token Google tidak ditemukan. Silakan hubungkan Google terlebih dahulu.");
  }

  if (!req.questions || req.questions.length === 0) {
    throw new Error("Daftar soal kosong. Tidak dapat membuat Google Form.");
  }

  const rawGrade = cleanGrade(req.grade);
  const formattedTitle = cleanTitle(req.title) || (req.subject ? `Kuis ${req.subject}${rawGrade ? ` Kelas ${rawGrade}` : ""}` : "Kuis Ujian Pilihan Ganda");

  // 1. Buat Google Form baru
  const createFormRes = await fetch("https://forms.googleapis.com/v1/forms", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      info: {
        title: formattedTitle,
        documentTitle: formattedTitle
      }
    })
  });

  if (!createFormRes.ok) {
    const errText = await createFormRes.text();
    console.error("Error creating Google Form:", createFormRes.status, errText);
    if (createFormRes.status === 401 || createFormRes.status === 403) {
      throw new Error("Izin akses Google kedaluwarsa atau tidak mencakup Google Forms. Silakan hubungkan ulang Google.");
    }
    throw new Error(`Gagal membuat Google Form: ${errText}`);
  }

  const formData = await createFormRes.json();
  const formId = formData.formId;
  const responderUrl = formData.responderUri || `https://docs.google.com/forms/d/e/${formId}/viewform`;
  const editUrl = `https://docs.google.com/forms/d/${formId}/edit`;

  // 2. Siapkan batch update: Aktifkan mode kuis + Deskripsi + Tambah seluruh butir soal
  const requests: any[] = [
    {
      updateSettings: {
        settings: {
          quizSettings: {
            isQuiz: true
          }
        },
        updateMask: "quizSettings.isQuiz"
      }
    },
    {
      updateFormInfo: {
        info: {
          description: req.description || 
            `Mata Pelajaran: ${req.subject || "-"}\nKelas: ${rawGrade ? `Kelas ${rawGrade}` : "-"}\nTotal Soal: ${req.questions.length} butir (Skor Maksimal: ${req.questions.reduce((sum, q) => sum + (typeof q.points === "number" && q.points > 0 ? q.points : 1), 0)} Poin)\nPetunjuk: Pilihlah satu jawaban yang paling tepat.`
        },
        updateMask: "description"
      }
    }
  ];

  let currentIndex = 0;

  // Jika opsi identitas diaktifkan (default true)
  const includeIdentity = req.includeIdentitySection !== false;

  if (includeIdentity) {
    // 1. Identitas: Nama Lengkap Siswa
    requests.push({
      createItem: {
        item: {
          title: "Nama Lengkap Siswa",
          description: "Tuliskan nama lengkap Anda sesuai data absensi kelas.",
          questionItem: {
            question: {
              required: true,
              textQuestion: {
                paragraph: false
              }
            }
          }
        },
        location: {
          index: currentIndex++
        }
      }
    });

    // 2. Identitas: Nomor Absen
    requests.push({
      createItem: {
        item: {
          title: "Nomor Absen",
          description: "Tuliskan nomor urut absen Anda (contoh: 01, 15, 32).",
          questionItem: {
            question: {
              required: true,
              textQuestion: {
                paragraph: false
              }
            }
          }
        },
        location: {
          index: currentIndex++
        }
      }
    });

    // 3. Identitas: Kelas (Dropdown jika ada pilihan kelas, atau Isian Singkat jika belum ada daftar kelas)
    const classOptions = req.classList && req.classList.length > 0
      ? req.classList.map(c => cleanTitle(c.trim())).filter(Boolean)
      : [];

    if (classOptions.length > 0) {
      requests.push({
        createItem: {
          item: {
            title: "Kelas",
            description: "Pilih kelas Anda dari daftar pilihan berikut.",
            questionItem: {
              question: {
                required: true,
                choiceQuestion: {
                  type: "DROP_DOWN",
                  shuffle: false,
                  options: classOptions.map(cls => ({ value: cls }))
                }
              }
            }
          },
          location: {
            index: currentIndex++
          }
        }
      });
    } else {
      requests.push({
        createItem: {
          item: {
            title: "Kelas",
            description: "Tuliskan nama kelas Anda (contoh: 8A, VII B).",
            questionItem: {
              question: {
                required: true,
                textQuestion: {
                  paragraph: false
                }
              }
            }
          },
          location: {
            index: currentIndex++
          }
        }
      });
    }

    // 4. Page Break / Halaman Baru (Section 2: Naskah Soal & Lembar Pengerjaan)
    requests.push({
      createItem: {
        item: {
          title: "Naskah Soal & Lembar Pengerjaan",
          description: "Petunjuk: Pilihlah salah satu jawaban yang paling tepat pada setiap butir pertanyaan berikut.",
          pageBreakItem: {}
        },
        location: {
          index: currentIndex++
        }
      }
    });
  }

  let totalPoints = 0;

  // Bangun items soal untuk Google Form
  req.questions.forEach((q, idx) => {
    const points = typeof q.points === "number" && q.points > 0 ? q.points : 1;
    totalPoints += points;

    // Format opsi jawaban TANPA label huruf A, B, C, D (murni teks pilihan jawaban)
    const options = q.options.map((opt) => {
      const cleanText = stripOptionPrefix(opt.text);
      return {
        label: opt.label,
        value: cleanText,
      };
    });

    // Cari opsi yang benar (cocokkan label A/B/C/D atau kecocokan teks jawaban)
    const normalizedCorrect = String(q.correctAnswer || "").trim().toUpperCase();
    const correctOpt = options.find((o) =>
      (o.label && o.label.toUpperCase() === normalizedCorrect) ||
      (o.value && o.value.toUpperCase() === normalizedCorrect) ||
      (stripOptionPrefix(o.value).toUpperCase() === stripOptionPrefix(String(q.correctAnswer || "")).toUpperCase())
    ) || options[0];
    const correctValue = correctOpt ? correctOpt.value : (options[0]?.value || "");

    let feedbackText = "";
    if (q.explanation && q.explanation.trim()) {
      feedbackText += `Pembahasan: ${q.explanation.trim()}`;
    }
    if (q.indicator && q.indicator.trim()) {
      feedbackText += `${feedbackText ? "\n" : ""}Indikator: ${q.indicator.trim()}`;
    }
    if (q.difficulty) {
      feedbackText += `${feedbackText ? "\n" : ""}Tingkat: ${q.difficulty} (${q.cognitiveLevel || "C2"})`;
    }

    // Teks soal MURNI tanpa nomor urut soal
    const cleanQuestionTitle = stripQuestionNumber(q.question);

    const itemObj: any = {
      title: cleanQuestionTitle,
      questionItem: {
        question: {
          required: true,
          grading: {
            pointValue: points,
            correctAnswers: {
              answers: [
                { value: correctValue }
              ]
            },
            ...(feedbackText ? {
              whenRight: {
                text: feedbackText
              },
              whenWrong: {
                text: feedbackText
              }
            } : {})
          },
          choiceQuestion: {
            type: "RADIO",
            shuffle: Boolean(req.shuffleOptions),
            options: options.map(o => ({ value: o.value }))
          }
        }
      }
    };

    // Tambahkan gambar jika soal memiliki imageUrl publik (HTTP/HTTPS)
    if (q.imageUrl && (q.imageUrl.startsWith("https://") || q.imageUrl.startsWith("http://"))) {
      itemObj.questionItem.image = {
        sourceUri: q.imageUrl,
        altText: q.imageCaption || `Gambar Pendukung Soal`,
        properties: {
          alignment: "CENTER"
        }
      };
    }

    requests.push({
      createItem: {
        item: itemObj,
        location: {
          index: currentIndex++
        }
      }
    });
  });

  // Kirim batch update ke Google Forms API
  let batchRes = await fetch(`https://forms.googleapis.com/v1/forms/${formId}:batchUpdate`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ requests })
  });

  // Jika gagal karena error gambar (misal URI gambar diblokir/tidak dapat diakses oleh Google), lakukan fallback tanpa image property
  if (!batchRes.ok) {
    const hasImages = req.questions.some(q => q.imageUrl);
    if (hasImages) {
      console.warn("Batch update dengan gambar mengalami kendala, mencoba fallback tanpa atribut gambar...");
      const strippedRequests = requests.map(reqItem => {
        if (reqItem.createItem?.item?.questionItem?.image) {
          const clone = JSON.parse(JSON.stringify(reqItem));
          delete clone.createItem.item.questionItem.image;
          return clone;
        }
        return reqItem;
      });

      const retryRes = await fetch(`https://forms.googleapis.com/v1/forms/${formId}:batchUpdate`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ requests: strippedRequests })
      });

      if (retryRes.ok) {
        batchRes = retryRes;
      }
    }
  }

  if (!batchRes.ok) {
    const batchErr = await batchRes.text();
    console.error("Error executing batchUpdate on Google Form:", batchRes.status, batchErr);
    // Meskipun batch update gagal sebagian, form-nya sudah dibuat. Kita tetap kembalikan info form agar guru bisa akses.
    throw new Error(`Google Form berhasil dibuat, namun gagal mengunggah butir soal: ${batchErr}`);
  }

  return {
    formId,
    title: req.title,
    editUrl,
    responderUrl,
    questionsCount: req.questions.length,
    totalPoints
  };
}
