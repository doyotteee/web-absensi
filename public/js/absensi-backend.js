/* kredit-maliki: Template oleh Maliki Saputra (@malikisaputra) — https://malikisaputra.biz.id. Lisensi Nonkomersial Maliki Studio: wajib kredit, dilarang dijual (lihat LICENSE). */
/* Absensi Karyawan — Versi Backend Laravel + SQL Database */

(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var CSRF = $('meta[name="csrf-token"]')?.getAttribute('content') || '';
  var STATE = {
    setting: {},
    shifts: [],
    karyawan: [],
    absenHariIni: [],
    izinMenunggu: 0,
    karyawanAktifId: null,
    adminUnlocked: false,
    bulanRekap: formatBulan(new Date()),
    bulanKalender: formatBulan(new Date()),
    kalenderKaryawanId: null,
    saringIzin: 'menunggu',
    lokasiKini: null
  };

  var HARI_P = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  var BULAN_P = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  function dua(n) { return (n < 10 ? '0' : '') + n; }
  function formatBulan(d) { return d.getFullYear() + '-' + dua(d.getMonth() + 1); }
  function rp(n) { n = Math.round(n || 0); return (n < 0 ? '−' : '') + 'Rp' + Math.abs(n).toLocaleString('id-ID'); }
  function inisial(n) { return String(n || '?').trim().split(/\s+/).slice(0, 2).map(function (s) { return s[0]; }).join('').toUpperCase(); }

  function api(url, method, data) {
    var opts = {
      method: method || 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-TOKEN': CSRF
      }
    };
    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(data);
    }
    return fetch(url, opts).then(function (res) {
      return res.json().then(function (json) {
        if (!res.ok) {
          throw new Error(json.message || ('Error ' + res.status));
        }
        return json;
      });
    });
  }

  function toast(msg) {
    var el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('muncul');
    clearTimeout(toast._tm);
    toast._tm = setTimeout(function () { el.classList.remove('muncul'); }, 3500);
  }

  // ---------- Dialog Helper ----------
  function bukaDlg(judul, htmlContent, aksiHtml, onSubmit) {
    var dlg = $('#dlg');
    $('#dlgJudul').textContent = judul;
    $('#dlgBadan').innerHTML = htmlContent;
    $('#dlgAksi').innerHTML = aksiHtml || '<button type="button" class="btn" id="dlgBatal">Batal</button><button type="submit" class="btn utama">OK</button>';
    $('#dlgBatal')?.addEventListener('click', function () { dlg.close(); });
    $('#dlgTutup').onclick = function () { dlg.close(); };
    $('#dlgForm').onsubmit = function (e) {
      e.preventDefault();
      if (onSubmit) onSubmit(new FormData($('#dlgForm')));
      dlg.close();
    };
    dlg.showModal();
  }

  // ---------- Inisialisasi ----------
  function init() {
    mulaiJam();
    pasangNavigasi();
    muatDataBootstrap();
    pasangFormAtur();
    mintaLokasi();
  }

  function mulaiJam() {
    function detak() {
      var d = new Date();
      var jamStr = dua(d.getHours()) + ':' + dua(d.getMinutes());
      var detikStr = ':' + dua(d.getSeconds());
      var tglStr = HARI_P[d.getDay()] + ', ' + d.getDate() + ' ' + BULAN_P[d.getMonth()] + ' ' + d.getFullYear();

      var elJam = $('#jamHidup');
      if (elJam) elJam.innerHTML = jamStr + '<small>' + detikStr + '</small>';
      var elTgl = $('#tglHari');
      if (elTgl) elTgl.textContent = tglStr;

      var kJam = $('#kioskJam');
      if (kJam) kJam.textContent = jamStr;
      var kTgl = $('#kioskTgl');
      if (kTgl) kTgl.textContent = tglStr;

      var sapa = $('#sapa');
      if (sapa) {
        var h = d.getHours();
        sapa.textContent = h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
      }
    }
    detak();
    setInterval(detak, 1000);
  }

  function mintaLokasi() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          STATE.lokasiKini = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          $('#syarat') && ($('#syarat').innerHTML = '<span class="pil-sukses">📍 GPS Aktif</span>');
        },
        function () {
          STATE.lokasiKini = null;
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }

  function muatDataBootstrap() {
    api('/api/bootstrap')
      .then(function (res) {
        var d = res.data;
        STATE.setting = d.setting;
        STATE.shifts = d.shifts;
        STATE.karyawan = d.karyawan;
        STATE.absenHariIni = d.absenHariIni;
        STATE.izinMenunggu = d.izinMenunggu;

        // Update badge
        var b1 = $('#lencanaIzin'), b2 = $('#lencanaIzin2');
        if (d.izinMenunggu > 0) {
          if (b1) { b1.textContent = d.izinMenunggu; b1.hidden = false; }
          if (b2) { b2.textContent = d.izinMenunggu; b2.hidden = false; }
        } else {
          if (b1) b1.hidden = true;
          if (b2) b2.hidden = true;
        }

        // Title & Brand
        if (d.setting.nama_kantor) {
          document.title = d.setting.nama_kantor + ' — Absensi Karyawan';
          $$('[data-tema-nama]').forEach(function (el) { el.textContent = d.setting.nama_kantor; });
        }

        renderPilihKaryawan();
        renderKartuAbsen();
        renderTimHariIni();
        renderKioskGrid();
      })
      .catch(function (err) {
        toast('Gagal memuat data: ' + err.message);
      });
  }

  function renderPilihKaryawan() {
    var sel = $('#pilihOrang');
    if (!sel) return;
    sel.innerHTML = '';
    STATE.karyawan.forEach(function (k, i) {
      var opt = document.createElement('option');
      opt.value = k.id;
      opt.textContent = k.nama + ' (' + k.jabatan + ')';
      sel.appendChild(opt);
    });

    if (STATE.karyawan.length > 0 && !STATE.karyawanAktifId) {
      STATE.karyawanAktifId = STATE.karyawan[0].id;
    }
    sel.value = STATE.karyawanAktifId;

    sel.onchange = function () {
      STATE.karyawanAktifId = parseInt(sel.value, 10);
      renderKartuAbsen();
    };
  }

  function getKaryawanAktif() {
    return STATE.karyawan.find(function (k) { return k.id === STATE.karyawanAktifId; });
  }

  function getAbsenKaryawanAktif() {
    return STATE.absenHariIni.find(function (a) { return a.employee_id === STATE.karyawanAktifId; });
  }

  function renderKartuAbsen() {
    var k = getKaryawanAktif();
    var a = getAbsenKaryawanAktif();
    var chip = $('#shiftChip');
    var btn = $('#tombolAbsen');
    var lbl = $('#labelAbsen');
    var sub = $('#subAbsen');
    var vM = $('#vMasuk'), vP = $('#vPulang'), vD = $('#vDurasi');
    var cincin = $('#cincinIsi');

    if (!k) {
      if (btn) btn.disabled = true;
      return;
    }

    if (chip) {
      var sh = k.shift;
      chip.textContent = sh ? (sh.nama + ' • ' + sh.masuk + ' - ' + sh.pulang) : 'Reguler';
    }

    if (!a) {
      // Belum Masuk
      lbl.textContent = 'Check-in';
      sub.textContent = 'Tap untuk masuk';
      btn.classList.remove('pulang', 'selesai');
      btn.disabled = false;
      vM.textContent = '--:--';
      vP.textContent = '--:--';
      vD.textContent = '0j 0m';
      if (cincin) cincin.style.strokeDashoffset = '641';
    } else if (a && !a.pulang) {
      // Sudah Masuk, Belum Pulang
      lbl.textContent = 'Check-out';
      sub.textContent = 'Tap untuk pulang';
      btn.classList.add('pulang');
      btn.classList.remove('selesai');
      btn.disabled = false;
      var inDate = new Date(a.masuk);
      vM.textContent = dua(inDate.getHours()) + ':' + dua(inDate.getMinutes());
      vP.textContent = '--:--';

      var diff = Math.max(0, Math.floor((new Date() - inDate) / 60000));
      vD.textContent = Math.floor(diff / 60) + 'j ' + (diff % 60) + 'm';
      if (cincin) cincin.style.strokeDashoffset = '320';
    } else {
      // Selesai
      lbl.textContent = 'Selesai';
      sub.textContent = 'Absen hari ini lengkap';
      btn.classList.add('selesai');
      btn.classList.remove('pulang');
      btn.disabled = true;

      var inD = new Date(a.masuk), outD = new Date(a.pulang);
      vM.textContent = dua(inD.getHours()) + ':' + dua(inD.getMinutes());
      vP.textContent = dua(outD.getHours()) + ':' + dua(outD.getMinutes());

      var durasi = Math.max(0, Math.floor((outD - inD) / 60000));
      vD.textContent = Math.floor(durasi / 60) + 'j ' + (durasi % 60) + 'm';
      if (cincin) cincin.style.strokeDashoffset = '0';
    }

    btn.onclick = function () {
      prosesAbsen(k.id, 'web');
    };
  }

  function prosesAbsen(karyawanId, sumber, pin) {
    var k = STATE.karyawan.find(function (item) { return item.id === karyawanId; });
    if (!k) return;

    function kirimPayload(fotoBase64) {
      var payload = {
        employee_id: karyawanId,
        sumber: sumber || 'web',
        pin: pin || null,
        lat: STATE.lokasiKini ? STATE.lokasiKini.lat : null,
        lng: STATE.lokasiKini ? STATE.lokasiKini.lng : null,
        foto: fotoBase64 || null
      };

      toast('Memproses absensi...');
      api('/api/absen', 'POST', payload)
        .then(function (res) {
          toast(res.message);
          muatDataBootstrap();
          if (sumber === 'kiosk') {
            setTimeout(function () { $('#kiosk').hidden = false; }, 1500);
          }
        })
        .catch(function (err) {
          toast('Gagal: ' + err.message);
          alert(err.message);
        });
    }

    if (STATE.setting.pakai_selfie) {
      ambilFotoSelfie(function (fotoBase64) {
        kirimPayload(fotoBase64);
      }, function () {
        if (STATE.setting.wajib_selfie) {
          toast('Selfie wajib diambil untuk melakukan absensi!');
        } else {
          kirimPayload(null);
        }
      });
    } else {
      kirimPayload(null);
    }
  }

  function ambilFotoSelfie(onSuccess, onCancel) {
    var videoHtml =
      '<div style="text-align:center;">' +
      '  <video id="kameraPratinjau" autoplay playsinline style="width:100%;max-width:320px;border-radius:12px;background:#000;transform:scaleX(-1);"></video>' +
      '  <canvas id="kameraKanvas" style="display:none;"></canvas>' +
      '  <p style="font-size:13px;color:var(--t-redup);margin-top:8px;">Posisikan wajah Anda di depan kamera</p>' +
      '</div>';

    var aksi =
      '<button type="button" class="btn" id="btnBatalKamera">Batal</button>' +
      '<button type="button" class="btn utama" id="btnJepret">Ambil Foto</button>';

    bukaDlg('Ambil Foto Selfie', videoHtml, aksi);

    var video = $('#kameraPratinjau');
    var kanvas = $('#kameraKanvas');
    var stream = null;

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 400 }, height: { ideal: 400 } } })
        .then(function (s) {
          stream = s;
          video.srcObject = s;
        })
        .catch(function () {
          // Fallback input file jika kamera browser diblokir
          $('#dlgBadan').innerHTML =
            '<div style="text-align:center;padding:16px;">' +
            '  <p style="margin-bottom:12px;">Kamera tidak dapat diakses langsung. Pilih foto selfie:</p>' +
            '  <input type="file" id="fallbackFoto" accept="image/*" capture="user" class="btn">' +
            '</div>';
          $('#fallbackFoto')?.addEventListener('change', function (e) {
            var file = e.target.files[0];
            if (file) {
              var reader = new FileReader();
              reader.onload = function (evt) {
                $('#dlg').close();
                onSuccess(evt.target.result);
              };
              reader.readAsDataURL(file);
            }
          });
        });
    }

    function matikanKamera() {
      if (stream) {
        stream.getTracks().forEach(function (t) { t.stop(); });
      }
    }

    $('#btnBatalKamera')?.addEventListener('click', function () {
      matikanKamera();
      $('#dlg').close();
      if (onCancel) onCancel();
    });

    $('#btnJepret')?.addEventListener('click', function () {
      if (!video || !video.videoWidth) {
        matikanKamera();
        $('#dlg').close();
        if (onCancel) onCancel();
        return;
      }
      kanvas.width = video.videoWidth;
      kanvas.height = video.videoHeight;
      var ctx = kanvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      var fotoBase64 = kanvas.toDataURL('image/jpeg', 0.8);
      matikanKamera();
      $('#dlg').close();
      onSuccess(fotoBase64);
    });
  }

  function renderTimHariIni() {
    var ul = $('#daftarTim');
    if (!ul) return;
    ul.innerHTML = '';

    var totalKaryawan = STATE.karyawan.length;
    var hadirCount = 0, telatCount = 0;

    STATE.karyawan.forEach(function (k) {
      var a = STATE.absenHariIni.find(function (item) { return item.employee_id === k.id; });
      var li = document.createElement('li');
      li.className = 'tim-item';

      var statusText = 'Belum hadir';
      var statusClass = 'pil-abu';

      if (a) {
        hadirCount++;
        if (a.telat > 0) {
          telatCount++;
          statusText = 'Telat ' + a.telat + 'm';
          statusClass = 'pil-kuning';
        } else {
          var inD = new Date(a.masuk);
          statusText = dua(inD.getHours()) + ':' + dua(inD.getMinutes());
          statusClass = 'pil-sukses';
        }
      }

      li.innerHTML =
        '<span class="avatar" style="background:' + k.warna + '">' + inisial(k.nama) + '</span>' +
        '<div class="tim-info"><b>' + k.nama + '</b><small>' + k.jabatan + '</small></div>' +
        '<span class="pil ' + statusClass + '">' + statusText + '</span>';

      ul.appendChild(li);
    });

    renderDonatHari(hadirCount, telatCount, Math.max(0, totalKaryawan - hadirCount));
  }

  function renderDonatHari(hadir, telat, belum) {
    var svg = $('#donatHari');
    var leg = $('#legendaHari');
    if (!svg || !leg) return;

    var total = hadir + belum;
    if (total === 0) total = 1;

    var pHadir = (hadir / total) * 100;
    var pBelum = (belum / total) * 100;

    svg.innerHTML =
      '<circle cx="60" cy="60" r="45" fill="none" stroke="var(--b-garis)" stroke-width="14"/>' +
      '<circle cx="60" cy="60" r="45" fill="none" stroke="var(--t-sukses)" stroke-width="14" stroke-dasharray="' + (pHadir * 2.82) + ' 282" stroke-dashoffset="0"/>';

    leg.innerHTML =
      '<li><span class="titik" style="background:var(--t-sukses)"></span> Hadir: ' + hadir + '</li>' +
      '<li><span class="titik" style="background:var(--t-peringatan)"></span> Telat: ' + telat + '</li>' +
      '<li><span class="titik" style="background:var(--t-redup)"></span> Belum: ' + belum + '</li>';
  }

  // ---------- Mode Kiosk ----------
  function renderKioskGrid() {
    var grid = $('#kioskGrid');
    if (!grid) return;
    grid.innerHTML = '';

    STATE.karyawan.forEach(function (k) {
      var a = STATE.absenHariIni.find(function (item) { return item.employee_id === k.id; });
      var btn = document.createElement('button');
      btn.className = 'kiosk-kartu' + (a ? (a.pulang ? ' lengkap' : ' hadir') : '');
      btn.innerHTML =
        '<span class="avatar besar" style="background:' + k.warna + '">' + inisial(k.nama) + '</span>' +
        '<b>' + k.nama + '</b>' +
        '<small>' + (a ? (a.pulang ? 'Sudah Pulang' : 'Sudah Masuk') : 'Ketuk untuk Masuk') + '</small>';

      btn.onclick = function () {
        if (k.pin) {
          mintaPin('Masukkan PIN Karyawan', function (pinInput) {
            prosesAbsen(k.id, 'kiosk', pinInput);
          });
        } else {
          prosesAbsen(k.id, 'kiosk');
        }
      };

      grid.appendChild(btn);
    });
  }

  function mintaPin(judul, onValid) {
    var html =
      '<div style="text-align:center;padding:12px;">' +
      '  <input type="password" id="inputPinDlg" inputmode="numeric" maxlength="6" pattern="[0-9]*" placeholder="••••" style="font-size:24px;text-align:center;letter-spacing:6px;width:160px;margin:12px auto;padding:8px;" autofocus required>' +
      '</div>';

    bukaDlg(judul, html, null, function () {
      var val = $('#inputPinDlg').value;
      if (val) onValid(val);
    });
  }

  // ---------- Navigasi Menu & Proteksi PIN Admin ----------
  function pasangNavigasi() {
    $$('button.nav').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var hal = btn.getAttribute('data-hal');
        bukaHalaman(hal);
      });
    });

    $$('[data-buka]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var hal = btn.getAttribute('data-buka');
        bukaHalaman(hal);
      });
    });

    // Kiosk
    $('#bukaKiosk')?.addEventListener('click', function () { $('#kiosk').hidden = false; });
    $('#bukaKiosk2')?.addEventListener('click', function () { $('#kiosk').hidden = false; });
    $('#tutupKiosk')?.addEventListener('click', function () {
      var pin = STATE.setting.pin_admin;
      if (pin) {
        mintaPin('PIN Admin untuk Keluar Kiosk', function (input) {
          if (input === pin) {
            $('#kiosk').hidden = true;
          } else {
            toast('PIN Admin salah!');
          }
        });
      } else {
        $('#kiosk').hidden = true;
      }
    });

    // Tombol CSV
    $('#eksporRekap')?.addEventListener('click', function () {
      window.location.href = '/api/ekspor/csv?bulan=' + STATE.bulanRekap;
    });
    $('#eksporAbsen')?.addEventListener('click', function () {
      window.location.href = '/api/ekspor/csv?bulan=' + STATE.bulanRekap;
    });

    // Izin Baru
    $('#izinBaru')?.addEventListener('click', bukaFormIzin);
    $('#ajukanIzin')?.addEventListener('click', bukaFormIzin);

    // Karyawan Baru
    $('#karyBaru')?.addEventListener('click', bukaFormKaryawan);
    $('#shiftBaru')?.addEventListener('click', bukaFormShift);

    // Filter Izin
    $$('.tab-seg .seg').forEach(function (tab) {
      tab.addEventListener('click', function () {
        $$('.tab-seg .seg').forEach(function (t) { t.setAttribute('aria-selected', 'false'); });
        tab.setAttribute('aria-selected', 'true');
        STATE.saringIzin = tab.getAttribute('data-saring');
        muatDaftarIzin();
      });
    });

    // Rekap Navigasi Bulan
    $('#rekSebelum')?.addEventListener('click', function () { geserBulanRekap(-1); });
    $('#rekSesudah')?.addEventListener('click', function () { geserBulanRekap(1); });

    // Kalender Navigasi Bulan
    $('#kalSebelum')?.addEventListener('click', function () { geserBulanKalender(-1); });
    $('#kalSesudah')?.addEventListener('click', function () { geserBulanKalender(1); });
  }

  function bukaHalaman(hal) {
    var perluPin = ['rekap', 'izin', 'karyawan', 'atur'].indexOf(hal) >= 0;
    var pinAdmin = STATE.setting.pin_admin;

    if (perluPin && pinAdmin && !STATE.adminUnlocked) {
      mintaPin('Masukkan PIN Admin', function (input) {
        if (input === pinAdmin) {
          STATE.adminUnlocked = true;
          tampilkanHalaman(hal);
        } else {
          toast('PIN Admin salah!');
        }
      });
      return;
    }

    tampilkanHalaman(hal);
  }

  function tampilkanHalaman(hal) {
    $$('section.hal').forEach(function (sec) { sec.hidden = true; });
    $$('button.nav').forEach(function (btn) {
      btn.classList.toggle('aktif', btn.getAttribute('data-hal') === hal);
    });

    var target = $('#hal-' + hal);
    if (target) {
      target.hidden = false;
      window.scrollTo(0, 0);
    }

    if (hal === 'rekap') muatRekap();
    if (hal === 'kalender') muatKalender();
    if (hal === 'izin') muatDaftarIzin();
    if (hal === 'karyawan') muatDaftarKaryawan();
  }

  // ---------- Rekap Bulanan ----------
  function geserBulanRekap(delta) {
    var p = STATE.bulanRekap.split('-');
    var d = new Date(+p[0], +p[1] - 1 + delta, 1);
    STATE.bulanRekap = formatBulan(d);
    muatRekap();
  }

  function muatRekap() {
    var bLabel = $('#rekBulan');
    if (bLabel) bLabel.textContent = STATE.bulanRekap;

    api('/api/rekap?bulan=' + STATE.bulanRekap)
      .then(function (res) {
        if (bLabel) bLabel.textContent = res.bulan;

        var ringkas = $('#ringkasRekap');
        if (ringkas) {
          ringkas.innerHTML =
            '<div class="kartu stat"><b>' + res.ringkasan.totalHadir + '</b><small>Total Hadir</small></div>' +
            '<div class="kartu stat"><b>' + res.ringkasan.totalTelat + '</b><small>Total Telat</small></div>' +
            '<div class="kartu stat"><b>' + res.ringkasan.totalIzin + '</b><small>Izin / Sakit</small></div>' +
            '<div class="kartu stat"><b>' + res.ringkasan.totalAlpa + '</b><small>Total Alpa</small></div>' +
            '<div class="kartu stat"><b>' + res.ringkasan.totalLembur + 'j</b><small>Lembur</small></div>';
        }

        var tbody = $('#tabelRekap tbody');
        if (tbody) {
          tbody.innerHTML = '';
          res.items.forEach(function (item) {
            var tr = document.createElement('tr');
            tr.innerHTML =
              '<td><b>' + item.employee.nama + '</b><br><small>' + item.employee.jabatan + '</small></td>' +
              '<td>' + item.hadir + '</td>' +
              '<td>' + (item.telat > 0 ? ('<span class="pil-kuning">' + item.telat + '</span>') : '0') + '</td>' +
              '<td>' + item.izin + '</td>' +
              '<td>' + (item.alpa > 0 ? ('<span class="pil-bahaya">' + item.alpa + '</span>') : '0') + '</td>' +
              '<td>' + Math.floor(item.lembur_menit / 60) + 'j ' + (item.lembur_menit % 60) + 'm</td>' +
              '<td>' + rp(item.tunjangan) + '</td>' +
              '<td>' + rp(item.potongan) + '</td>' +
              '<td><b>' + rp(item.bersih) + '</b></td>';
            tbody.appendChild(tr);
          });
        }
      })
      .catch(function (err) {
        toast('Gagal memuat rekap: ' + err.message);
      });
  }

  // ---------- Kalender ----------
  function geserBulanKalender(delta) {
    var p = STATE.bulanKalender.split('-');
    var d = new Date(+p[0], +p[1] - 1 + delta, 1);
    STATE.bulanKalender = formatBulan(d);
    muatKalender();
  }

  function muatKalender() {
    var chipWrap = $('#chipOrang');
    if (chipWrap && STATE.karyawan.length > 0) {
      chipWrap.innerHTML = '';
      STATE.karyawan.forEach(function (k) {
        var btn = document.createElement('button');
        btn.className = 'chip' + (k.id === (STATE.kalenderKaryawanId || STATE.karyawan[0].id) ? ' aktif' : '');
        btn.textContent = k.nama;
        btn.onclick = function () {
          STATE.kalenderKaryawanId = k.id;
          muatKalender();
        };
        chipWrap.appendChild(btn);
      });
    }

    var kid = STATE.kalenderKaryawanId || (STATE.karyawan[0] ? STATE.karyawan[0].id : null);
    if (!kid) return;

    var p = STATE.bulanKalender.split('-');
    var blnIndex = +p[1] - 1;
    var thn = +p[0];
    $('#kalBulan') && ($('#kalBulan').textContent = BULAN_P[blnIndex] + ' ' + thn);

    api('/api/kalender?bulan=' + STATE.bulanKalender + '&employee_id=' + kid)
      .then(function (res) {
        renderKalenderGrid(thn, blnIndex, res.attendances, res.leaves);
      });
  }

  function renderKalenderGrid(tahun, bulan, attendances, leaves) {
    var grid = $('#kalGrid');
    if (!grid) return;
    grid.innerHTML = '';

    ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].forEach(function (h) {
      var hCell = document.createElement('div');
      hCell.className = 'kal-kepala';
      hCell.textContent = h;
      grid.appendChild(hCell);
    });

    var firstDay = new Date(tahun, bulan, 1).getDay();
    var daysInMonth = new Date(tahun, bulan + 1, 0).getDate();

    for (var i = 0; i < firstDay; i++) {
      var kosong = document.createElement('div');
      kosong.className = 'kal-sel kosong';
      grid.appendChild(kosong);
    }

    for (var day = 1; day <= daysInMonth; day++) {
      var tglStr = tahun + '-' + dua(bulan + 1) + '-' + dua(day);
      var sel = document.createElement('div');
      sel.className = 'kal-sel';

      var att = attendances.find(function (a) { return a.tgl === tglStr; });
      var dotClass = '';
      var infoText = '';

      if (att) {
        if (att.telat > 0) {
          dotClass = 'telat';
          infoText = 'Telat ' + att.telat + 'm';
        } else {
          dotClass = 'hadir';
          infoText = 'Hadir';
        }
      }

      sel.innerHTML = '<span class="tgl-angka">' + day + '</span>' + (dotClass ? ('<span class="kal-titik ' + dotClass + '"></span>') : '');

      (function (dNum, aItem) {
        sel.onclick = function () {
          $$('.kal-sel').forEach(function (s) { s.classList.remove('terpilih'); });
          sel.classList.add('terpilih');

          var det = $('#detailHari');
          if (det) {
            if (aItem) {
              var inD = new Date(aItem.masuk), outD = aItem.pulang ? new Date(aItem.pulang) : null;
              det.innerHTML =
                '<h3>' + dNum + ' ' + BULAN_P[bulan] + ' ' + tahun + '</h3>' +
                '<p>Masuk: <b>' + dua(inD.getHours()) + ':' + dua(inD.getMinutes()) + '</b></p>' +
                '<p>Pulang: <b>' + (outD ? (dua(outD.getHours()) + ':' + dua(outD.getMinutes())) : 'Belum pulang') + '</b></p>' +
                '<p>Keterlambatan: <b>' + aItem.telat + ' menit</b></p>' +
                '<p>Lembur: <b>' + Math.floor(aItem.lembur / 60) + 'j ' + (aItem.lembur % 60) + 'm</b></p>';
            } else {
              det.innerHTML = '<h3>' + dNum + ' ' + BULAN_P[bulan] + ' ' + tahun + '</h3><p class="redup">Tidak ada catatan kehadiran.</p>';
            }
          }
        };
      })(day, att);

      grid.appendChild(sel);
    }
  }

  // ---------- Izin & Cuti ----------
  function muatDaftarIzin() {
    api('/api/leaves?status=' + STATE.saringIzin)
      .then(function (res) {
        var ul = $('#daftarIzin');
        if (!ul) return;
        ul.innerHTML = '';

        if (res.data.length === 0) {
          ul.innerHTML = '<li style="text-align:center;padding:24px;color:var(--t-redup);">Tidak ada pengajuan ' + STATE.saringIzin + '.</li>';
          return;
        }

        res.data.forEach(function (item) {
          var li = document.createElement('li');
          li.className = 'kartu izin-item';
          li.innerHTML =
            '<div class="izin-kepala">' +
            '  <div><b>' + item.employee.nama + '</b> <span class="pil pil-kuning">' + item.jenis.toUpperCase() + '</span></div>' +
            '  <small>' + item.dari + ' s/d ' + item.sampai + '</small>' +
            '</div>' +
            '<p class="izin-alasan">' + item.alasan + '</p>' +
            (item.lampiran ? ('<a href="' + item.lampiran + '" target="_blank" class="tautan kecil">Lihat Lampiran Foto</a>') : '') +
            (item.status === 'menunggu' ? (
              '<div class="baris-aksi" style="margin-top:12px;">' +
              '  <button class="btn btn-setujui" data-id="' + item.id + '">Setujui</button>' +
              '  <button class="btn bahaya btn-tolak" data-id="' + item.id + '">Tolak</button>' +
              '</div>'
            ) : '');

          li.querySelector('.btn-setujui')?.addEventListener('click', function () {
            api('/api/leaves/' + item.id, 'PATCH', { status: 'disetujui' }).then(function () {
              toast('Pengajuan disetujui');
              muatDaftarIzin();
              muatDataBootstrap();
            });
          });

          li.querySelector('.btn-tolak')?.addEventListener('click', function () {
            api('/api/leaves/' + item.id, 'PATCH', { status: 'ditolak' }).then(function () {
              toast('Pengajuan ditolak');
              muatDaftarIzin();
              muatDataBootstrap();
            });
          });

          ul.appendChild(li);
        });
      });
  }

  function bukaFormIzin() {
    var kOpts = STATE.karyawan.map(function (k) {
      return '<option value="' + k.id + '">' + k.nama + ' (' + k.jabatan + ')</option>';
    }).join('');

    var todayStr = new Date().toISOString().split('T')[0];

    var formHtml =
      '<div style="display:flex;flex-direction:column;gap:12px;">' +
      '  <label class="label">Karyawan</label><select id="inIzinKaryawan" class="input">' + kOpts + '</select>' +
      '  <label class="label">Jenis</label><select id="inIzinJenis" class="input"><option value="izin">Izin</option><option value="sakit">Sakit</option><option value="cuti">Cuti</option></select>' +
      '  <div class="dua"><div><label class="label">Dari Tanggal</label><input type="date" id="inIzinDari" value="' + todayStr + '" class="input"></div><div><label class="label">Sampai Tanggal</label><input type="date" id="inIzinSampai" value="' + todayStr + '" class="input"></div></div>' +
      '  <label class="label">Alasan</label><textarea id="inIzinAlasan" rows="3" class="input" placeholder="Jelaskan alasan..."></textarea>' +
      '</div>';

    bukaDlg('Ajukan Izin / Sakit / Cuti', formHtml, null, function () {
      var payload = {
        employee_id: $('#inIzinKaryawan').value,
        jenis: $('#inIzinJenis').value,
        dari: $('#inIzinDari').value,
        sampai: $('#inIzinSampai').value,
        alasan: $('#inIzinAlasan').value
      };

      api('/api/leaves', 'POST', payload)
        .then(function (res) {
          toast(res.message);
          muatDataBootstrap();
          muatDaftarIzin();
        })
        .catch(function (err) {
          toast(err.message);
        });
    });
  }

  // ---------- Karyawan & Shift ----------
  function muatDaftarKaryawan() {
    var gridK = $('#gridKary');
    if (gridK) {
      gridK.innerHTML = '';
      STATE.karyawan.forEach(function (k) {
        var card = document.createElement('div');
        card.className = 'kartu kary-kartu';
        card.innerHTML =
          '<div style="display:flex;align-items:center;gap:12px;">' +
          '  <span class="avatar" style="background:' + k.warna + '">' + inisial(k.nama) + '</span>' +
          '  <div><b>' + k.nama + '</b><br><small>' + k.jabatan + ' • Shift ' + (k.shift ? k.shift.nama : '-') + '</small></div>' +
          '</div>' +
          '<div class="baris-aksi" style="margin-top:12px;">' +
          '  <button class="btn kecil btn-edit-kary" data-id="' + k.id + '">Edit</button>' +
          '  <button class="btn kecil bahaya btn-hapus-kary" data-id="' + k.id + '">Hapus</button>' +
          '</div>';

        card.querySelector('.btn-edit-kary').onclick = function () { bukaFormKaryawan(k); };
        card.querySelector('.btn-hapus-kary').onclick = function () {
          if (confirm('Hapus karyawan ' + k.nama + '?')) {
            api('/api/karyawan/' + k.id, 'DELETE').then(function () {
              toast('Karyawan dihapus');
              muatDataBootstrap();
              muatDaftarKaryawan();
            });
          }
        };

        gridK.appendChild(card);
      });
    }

    var gridS = $('#gridShift');
    if (gridS) {
      gridS.innerHTML = '';
      STATE.shifts.forEach(function (sh) {
        var card = document.createElement('div');
        card.className = 'kartu shift-kartu';
        card.innerHTML =
          '<b>Shift ' + sh.nama + '</b>' +
          '<p>' + sh.masuk + ' - ' + sh.pulang + ' (Toleransi: ' + sh.toleransi + 'm)</p>' +
          '<div class="baris-aksi">' +
          '  <button class="btn kecil btn-edit-shift">Edit</button>' +
          '  <button class="btn kecil bahaya btn-hapus-shift">Hapus</button>' +
          '</div>';

        card.querySelector('.btn-edit-shift').onclick = function () { bukaFormShift(sh); };
        card.querySelector('.btn-hapus-shift').onclick = function () {
          if (confirm('Hapus shift ' + sh.nama + '?')) {
            api('/api/shift/' + sh.id, 'DELETE')
              .then(function () {
                toast('Shift dihapus');
                muatDataBootstrap();
                muatDaftarKaryawan();
              })
              .catch(function (err) { alert(err.message); });
          }
        };

        gridS.appendChild(card);
      });
    }
  }

  function bukaFormKaryawan(k) {
    k = k || {};
    var shiftOpts = STATE.shifts.map(function (s) {
      return '<option value="' + s.id + '" ' + (k.shift_id === s.id ? 'selected' : '') + '>' + s.nama + ' (' + s.masuk + '-' + s.pulang + ')</option>';
    }).join('');

    var html =
      '<div style="display:flex;flex-direction:column;gap:12px;">' +
      '  <label class="label">Nama Lengkap</label><input id="kNama" class="input" value="' + (k.nama || '') + '" required>' +
      '  <label class="label">Jabatan</label><input id="kJabatan" class="input" value="' + (k.jabatan || '') + '" required>' +
      '  <label class="label">Shift</label><select id="kShift" class="input">' + shiftOpts + '</select>' +
      '  <label class="label">PIN Kiosk (4-6 digit angka)</label><input id="kPin" class="input" inputmode="numeric" value="' + (k.pin || '1234') + '">' +
      '</div>';

    bukaDlg(k.id ? 'Edit Karyawan' : 'Tambah Karyawan', html, null, function () {
      var payload = {
        id: k.id || null,
        nama: $('#kNama').value,
        jabatan: $('#kJabatan').value,
        shift_id: $('#kShift').value,
        pin: $('#kPin').value
      };
      api('/api/karyawan', 'POST', payload).then(function () {
        toast('Karyawan berhasil disimpan');
        muatDataBootstrap();
        muatDaftarKaryawan();
      });
    });
  }

  function bukaFormShift(sh) {
    sh = sh || {};
    var html =
      '<div style="display:flex;flex-direction:column;gap:12px;">' +
      '  <label class="label">Nama Shift</label><input id="sNama" class="input" value="' + (sh.nama || '') + '" placeholder="mis. Pagi" required>' +
      '  <div class="dua"><div><label class="label">Jam Masuk</label><input id="sMasuk" type="time" class="input" value="' + (sh.masuk || '08:00') + '" required></div><div><label class="label">Jam Pulang</label><input id="sPulang" type="time" class="input" value="' + (sh.pulang || '16:00') + '" required></div></div>' +
      '  <label class="label">Toleransi Keterlambatan (menit)</label><input id="sToleransi" type="number" class="input" value="' + (sh.toleransi || 10) + '">' +
      '</div>';

    bukaDlg(sh.id ? 'Edit Shift' : 'Tambah Shift', html, null, function () {
      var payload = {
        id: sh.id || null,
        nama: $('#sNama').value,
        masuk: $('#sMasuk').value,
        pulang: $('#sPulang').value,
        toleransi: parseInt($('#sToleransi').value, 10)
      };
      api('/api/shift', 'POST', payload).then(function () {
        toast('Shift berhasil disimpan');
        muatDataBootstrap();
        muatDaftarKaryawan();
      });
    });
  }

  // ---------- Form Pengaturan ----------
  function pasangFormAtur() {
    $('#lokasiSini')?.addEventListener('click', function () {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function (pos) {
          $('#inLat').value = pos.coords.latitude.toFixed(6);
          $('#inLng').value = pos.coords.longitude.toFixed(6);
          toast('Lokasi perangkat berhasil diisi');
        });
      }
    });

    $('#formLokasi')?.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = {
        pakai_lokasi: $('#pakaiLokasi').checked,
        wajib_radius: $('#wajibRadius').checked,
        lat: parseFloat($('#inLat').value) || null,
        lng: parseFloat($('#inLng').value) || null,
        radius: parseInt($('#inRadius').value, 10) || 150
      };
      simpanSettings(data);
    });

    $('#formSelfie')?.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = {
        pakai_selfie: $('#pakaiSelfie').checked,
        wajib_selfie: $('#wajibSelfie').checked,
        pin_admin: $('#inPinAdmin').value
      };
      simpanSettings(data);
    });

    $('#formUang')?.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = {
        uang_makan: parseInt($('#inMakan').value, 10) || 0,
        uang_lembur: parseInt($('#inLembur').value, 10) || 0,
        pot_telat: parseInt($('#inPotTelat').value, 10) || 0,
        pot_alpa: parseInt($('#inPotAlpa').value, 10) || 0,
        min_lembur: parseInt($('#inMinLembur').value, 10) || 30
      };
      simpanSettings(data);
    });
  }

  function simpanSettings(payload) {
    api('/api/settings', 'POST', payload)
      .then(function (res) {
        toast('Pengaturan berhasil disimpan di server database!');
        STATE.setting = res.data;
      })
      .catch(function (err) {
        toast('Gagal: ' + err.message);
      });
  }

  // Start app
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
