document.addEventListener('DOMContentLoaded', function(){
  // (ลบ logic สลับแท็บ Docs เพราะหน้า Docs แยกไฟล์แล้ว)
  const form = document.getElementById('searchForm');
  const query = document.getElementById('query');
  const result = document.getElementById('result');
  const radios = document.querySelectorAll('input[name="searchType"]');
  const tableBody = document.getElementById('result-table-body');
  const progressPercent = document.getElementById('progress-percent');

  function updatePlaceholder(){
    const type = document.querySelector('input[name="searchType"]:checked').value;
    if(type === 'cid'){
      query.placeholder = 'เช่น 1234567890123 (13 หลัก)';
      query.maxLength = 13;
    } else if(type === 'pea') {
      query.placeholder = 'เลขบัตรประชาชน,เบอร์มือถือหรืออีเมล';
      query.maxLength = 64;
    } else if(type === 'shipmile') {
      query.placeholder = 'เลขบัตรประชาชน 13 หลัก (ขนส่ง)';
      query.maxLength = 13;
    } else {
      query.placeholder = 'เช่น 0812345678';
      query.maxLength = 10;
    }
    query.value = '';
    result.textContent = 'ยังไม่มีการค้นหา';
    result.className = 'result-empty';
    tableBody.innerHTML = '';
    if(progressPercent) progressPercent.textContent = '';
  }

  radios.forEach(r => r.addEventListener('change', updatePlaceholder));
  updatePlaceholder();

  // เก็บผลการค้นหา
  let searchHistory = [];

  function renderHistory() {
    tableBody.innerHTML = '';
    searchHistory.forEach((item, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${item.query}</td>
        <td style="color:${item.status === 'SUCCESS' ? 'green' : 'red'};font-weight:bold;">${item.status}</td>
        <td>${item.note}</td>
      `;
      tableBody.appendChild(tr);
    });
  }

  form.addEventListener('submit', async function(e){
    e.preventDefault();
    const val = query.value.trim();
    if(!val){
      result.textContent = 'กรุณากรอกหมายเลขเพื่อค้นหา';
      result.className = 'result-error';
      tableBody.innerHTML = '';
      if(progressPercent) progressPercent.textContent = '';
      return;
    }
    result.textContent = 'กำลังเชื่อมต่อ API...';
    result.className = 'result-loading';
    tableBody.innerHTML = '';
    if(progressPercent) progressPercent.textContent = '';

    // เริ่ม fake progress
    let fakeProgress = 0;
    let progressTimer = null;
    function startFakeProgress() {
      fakeProgress = 0;
      if(progressPercent) progressPercent.textContent = ' 0%';
      progressTimer = setInterval(() => {
        if(fakeProgress < 90) {
          fakeProgress += Math.floor(Math.random()*4)+1; // เพิ่มทีละ 1-4%
          if(fakeProgress > 90) fakeProgress = 90;
          if(progressPercent) progressPercent.textContent = ' ' + fakeProgress + '%';
        }
      }, 120);
    }
    function stopFakeProgress() {
      if(progressTimer) clearInterval(progressTimer);
      progressTimer = null;
    }
    startFakeProgress();
    try {
  result.textContent = 'กำลังส่งคำขอ...';
      const type = document.querySelector('input[name="searchType"]:checked').value;
      let url = 'http://localhost:5000/api/search';
      let category = '';
      if(type === 'cid') category = 'nhso';
      else if(type === 'pea') category = 'pea';
      else if(type === 'shipmile') category = 'shipmile';
      else category = 'truemove';
      let body = { category: category, value: val };
      let headers = {
        'Content-Type': 'application/json',
        'X-API-Token': 'mysecrettoken'
      };
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
      result.textContent = 'กำลังดึงข้อมูล...';
      const data = await res.json();
      stopFakeProgress();
      if(progressPercent) progressPercent.textContent = ' 100%';
      let d = {};
      let addr = {};
      let nhso = false;
      // รองรับทุกรูปแบบ response
      let peaDataArray = null;
      if (data && data.result && Array.isArray(data.result) && data.result.length > 0) {
        // NHSO (array)
        d = data.result[0];
        addr = d['address-list'] && d['address-list']['CUSTOMER_ADDRESS'] ? d['address-list']['CUSTOMER_ADDRESS'] : {};
      } else if (data && data.result && Array.isArray(data.result.Data) && data.result.Data.length > 0) {
        // PEA (Data array)
        peaDataArray = data.result.Data;
      } else if (data && data.result && Array.isArray(data.result.content) && data.result.content.length > 0) {
        // DLT API (content array)
        d = data.result.content[0];
        addr = {
          address: d.address || '-',
          officeBranch: d.officeBranch || '-',
          officeBranchCode: d.officeBranchCode || '-'
        };
      } else if (data && data.result && typeof data.result === 'object') {
        // True API (object)
        if (data.result['response-data']) {
          d = data.result['response-data'];
        } else if (data.result['personData']) {
          nhso = true;
          d = data.result['personData'];
        } else {
          d = data.result;
        }
        addr = d['address-list'] && d['address-list']['CUSTOMER_ADDRESS'] ? d['address-list']['CUSTOMER_ADDRESS'] : {};
      } else if (data && data['response-data']) {
        // True API (response-data root)
        d = data['response-data'];
        addr = d['address-list'] && d['address-list']['CUSTOMER_ADDRESS'] ? d['address-list']['CUSTOMER_ADDRESS'] : {};
      } else if (data && data.personData) {
        // NHSO (personData root)
        nhso = true;
        d = data.personData;
        addr = {
          number: d.homeAddress ? d.homeAddress.adressNo : '-',
          moo: d.addressCatm ? d.addressCatm.moo : '-',
          buildingName: '-',
          subDistrict: d.addressCatm ? d.addressCatm.tumbonName : '-',
          district: d.addressCatm ? d.addressCatm.amphurName : '-',
          province: d.addressCatm ? d.addressCatm.changwatName : '-',
          zip: '-',
        };
      } else if (data && typeof data === 'object' && Object.keys(data).length > 0) {
        // Fallback: กรณีข้อมูลอยู่ใน result โดยตรง
        d = data;
        addr = d['address-list'] && d['address-list']['CUSTOMER_ADDRESS'] ? d['address-list']['CUSTOMER_ADDRESS'] : {};
      } else {
        d = {};
        addr = {};
      }

      // ถ้าเป็น PEA (peaDataArray) ให้แสดงผลแบบ card ถ้ามีข้อมูลเดียว (ค้นหาด้วยเบอร์มือถือ) หรือแสดงตารางถ้ามีหลาย record
      if (peaDataArray) {
        // ถ้าเป็นแบบค้นหาด้วยเบอร์มือถือ (Data มี 1 record และมี CitizenID)
        if (peaDataArray.length === 1 && peaDataArray[0].CitizenID) {
          const item = peaDataArray[0];
          let html = `<div class="result-card-embed animate-fadein" style="background:#fff;color:#222;border-radius:16px;padding:32px 24px;max-width:520px;margin:auto;box-shadow:0 4px 24px #0001;">
            <div style="display:flex;align-items:center;gap:16px;margin-bottom:18px;">
              <span style="font-size:2.2em;background:#e0e7ff;padding:10px 16px;border-radius:12px;">⚡</span>
              <div>
                <b style="font-size:1.25em;letter-spacing:0.5px;">ข้อมูลลูกค้า PEA</b><br>
                <span style="color:#6b7280;font-size:1em;">${item.CitizenID || '-'}</span>
              </div>
              <button id="copyResultBtn" title="คัดลอกข้อมูล" style="margin-left:auto;background:#f3f4f6;border:none;border-radius:8px;padding:8px 12px;cursor:pointer;font-size:1em;">Copy</button>
            </div>
            <div style="margin-bottom:18px;">
              <div style="margin-bottom:6px;"><span style="color:#6366f1;font-size:1.1em;">🪪</span> <b>ชื่อ:</b> ${item.FullName || '-'}</div>
              <div style="margin-bottom:6px;"><span style="color:#6366f1;font-size:1.1em;">#️⃣</span> <b>เลขบัตร:</b> ${item.CitizenID || '-'}</div>
              <div style="margin-bottom:6px;"><span style="color:#6366f1;font-size:1.1em;">📱</span> <b>เบอร์มือถือ:</b> ${item.MobilePhone || '-'}</div>
              <div style="margin-bottom:6px;"><span style="color:#6366f1;font-size:1.1em;">✉️</span> <b>อีเมล:</b> ${item.Email || '-'}</div>
              <div style="margin-bottom:6px;"><span style="color:#6366f1;font-size:1.1em;">🗓️</span> <b>วันที่ลงทะเบียน:</b> ${item.RegisterDate || '-'}</div>
            </div>
          </div>`;
          result.innerHTML = html;
          result.className = 'result-success';
          stopFakeProgress();
          if(progressPercent) progressPercent.textContent = ' 100%';
          // ปุ่ม copy
          const copyBtn = document.getElementById('copyResultBtn');
          if(copyBtn){
            copyBtn.onclick = () => {
              const text = `ชื่อ: ${item.FullName||''}\nเลขบัตร: ${item.CitizenID||'-'}\nเบอร์: ${item.MobilePhone||'-'}\nอีเมล: ${item.Email||'-'}\nวันที่ลงทะเบียน: ${item.RegisterDate||'-'}`;
              navigator.clipboard.writeText(text);
              copyBtn.textContent = 'คัดลอกแล้ว';
              setTimeout(()=>{copyBtn.textContent='Copy';},1200);
            }
          }
          return;
        }
        // ถ้าเป็นแบบค้นหาด้วยเลขบัตร (หรือมีหลาย record)
        result.textContent = '';
        result.className = '';
        tableBody.innerHTML = '';
        peaDataArray.forEach((item, idx) => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${idx + 1}</td>
            <td>${item.CaNo || '-'}</td>
            <td style="color:${item.Status === 'True' ? 'green' : 'red'};font-weight:bold;">${item.Status === 'True' ? 'SUCCESS' : 'FAILED'}</td>
            <td>${item.Fullname || '-'}<br>${item.Alias || ''}</td>
          `;
          tableBody.appendChild(tr);
        });
        stopFakeProgress();
        if(progressPercent) progressPercent.textContent = ' 100%';
        return;
      }

      // ตรวจสอบเฉพาะ firstname เท่านั้น
      // ตรวจสอบข้อมูล DLT
      let isDLT = d && d.citizenCardNumber && d.fullName;
      const firstname = nhso ? d.fname : (isDLT ? d.fullName : d.firstname);
      const hasData = firstname && firstname !== '-';

      let status = 'SUCCESS';
      let note = 'พบข้อมูล';

      if (!hasData) {
        status = 'FAILED';
        note = 'ไม่พบข้อมูลหรือข้อมูลไม่สมบูรณ์';
        result.innerHTML = '<div style="color:red;font-size:2em;font-weight:bold;text-align:center;margin:40px 0;">ไม่พบในฐานข้อมูล</div>';
        result.className = 'result-error';
        stopFakeProgress();
        if(progressPercent) progressPercent.textContent = ' 100%';
      } else if (isDLT) {
        // แสดงผลข้อมูล DLT
        let html = `<div class="result-card-embed animate-fadein" style="background:#fff;color:#222;border-radius:16px;padding:32px 24px;max-width:520px;margin:auto;box-shadow:0 4px 24px #0001;">
          <div style="display:flex;align-items:center;gap:16px;margin-bottom:18px;">
            <span style="font-size:2.2em;background:#e0e7ff;padding:10px 16px;border-radius:12px;">🚗</span>
            <div>
              <b style="font-size:1.25em;letter-spacing:0.5px;">ข้อมูลใบขับขี่ DLT</b><br>
              <span style="color:#6b7280;font-size:1em;">${d.citizenCardNumber || '-'}</span>
            </div>
            <button id="copyResultBtn" title="คัดลอกข้อมูล" style="margin-left:auto;background:#f3f4f6;border:none;border-radius:8px;padding:8px 12px;cursor:pointer;font-size:1em;">Copy</button>
          </div>
          <div style="margin-bottom:18px;">
            <div style="margin-bottom:6px;"><span style="color:#6366f1;font-size:1.1em;">🪪</span> <b>ชื่อ:</b> ${d.fullName || '-'}</div>
            <div style="margin-bottom:6px;"><span style="color:#6366f1;font-size:1.1em;">#️⃣</span> <b>เลขบัตร:</b> ${d.citizenCardNumber || '-'}</div>
            <div style="margin-bottom:6px;"><span style="color:#6366f1;font-size:1.1em;">🏠</span> <b>ที่อยู่:</b> ${d.address || '-'}</div>
            <div style="margin-bottom:6px;"><span style="color:#6366f1;font-size:1.1em;">🏢</span> <b>สำนักงาน:</b> ${d.officeBranch || '-'} (${d.officeBranchCode || '-'})</div>
            <div style="margin-bottom:6px;"><span style="color:#6366f1;font-size:1.1em;">🚗</span> <b>ประเภทใบขับขี่:</b> ${d.type || '-'}</div>
            <div style="margin-bottom:6px;"><span style="color:#6366f1;font-size:1.1em;">�</span> <b>เลขที่ใบขับขี่:</b> ${d.licenseNumber || '-'}</div>
            <div style="margin-bottom:6px;"><span style="color:#6366f1;font-size:1.1em;">🗓️</span> <b>วันออกใบขับขี่:</b> ${d.issueDateString || (d.licenseIssueDate ? d.licenseIssueDate.split('T')[0] : '-')}</div>
            <div style="margin-bottom:6px;"><span style="color:#6366f1;font-size:1.1em;">⏳</span> <b>วันหมดอายุ:</b> ${d.expirationDateString || (d.licenseExpirationDate ? d.licenseExpirationDate.split('T')[0] : '-')}</div>
            <div style="margin-bottom:6px;"><span style="color:#6366f1;font-size:1.1em;">📊</span> <b>สถานะ:</b> ${d.status || '-'}</div>
          </div>
        </div>`;
        result.innerHTML = html;
        result.className = 'result-success';
        stopFakeProgress();
        if(progressPercent) progressPercent.textContent = ' 100%';
        // ปุ่ม copy
        const copyBtn = document.getElementById('copyResultBtn');
        if(copyBtn){
          const text = `ชื่อ: ${d.fullName||'-'}\nเลขบัตร: ${d.citizenCardNumber||'-'}\nที่อยู่: ${d.address||'-'}\nสำนักงาน: ${d.officeBranch||'-'} (${d.officeBranchCode||'-'})\nประเภทใบขับขี่: ${d.type||'-'}\nเลขที่ใบขับขี่: ${d.licenseNumber||'-'}\nวันออกใบขับขี่: ${d.issueDateString||'-'}\nวันหมดอายุ: ${d.expirationDateString||'-'}\nสถานะ: ${d.status||'-'}`;
          copyBtn.onclick = () => {
            navigator.clipboard.writeText(text);
            copyBtn.textContent = 'คัดลอกแล้ว';
            setTimeout(()=>{copyBtn.textContent='Copy';},1200);
          }
        }
      } else {
        let html = `<div class="result-card-embed animate-fadein" style="background:#fff;color:#222;border-radius:16px;padding:32px 24px;max-width:520px;margin:auto;box-shadow:0 4px 24px #0001;">
          <div style="display:flex;align-items:center;gap:16px;margin-bottom:18px;">
            <span style="font-size:2.2em;background:#e0e7ff;padding:10px 16px;border-radius:12px;">�👤</span>
            <div>
              <b style="font-size:1.25em;letter-spacing:0.5px;">ข้อมูลลูกค้า/สิทธิ</b><br>
              <span style="color:#6b7280;font-size:1em;">${nhso ? d.pid : (d['contact-mobile-number']||d['contact-number']||d['pid']||'-')}</span>
            </div>
            <button id="copyResultBtn" title="คัดลอกข้อมูล" style="margin-left:auto;background:#f3f4f6;border:none;border-radius:8px;padding:8px 12px;cursor:pointer;font-size:1em;">Copy</button>
          </div>
          <div style="margin-bottom:18px;">
            <div style="margin-bottom:6px;"><span style="color:#6366f1;font-size:1.1em;">🪪</span> <b>ชื่อ:</b> ${nhso ? (d.titleName||'') + ' ' + (d.fname||'') + ' ' + (d.lname||'') : (d.title||d.name||'') + ' ' + (d.firstname||'') + ' ' + (d.lastname||'')}</div>
            <div style="margin-bottom:6px;"><span style="color:#6366f1;font-size:1.1em;">#️⃣</span> <b>เลขบัตร:</b> ${nhso ? d.pid : (d['id-number']||d['pid']||'-')}</div>
            <div style="margin-bottom:6px;"><span style="color:#6366f1;font-size:1.1em;">🎂</span> <b>วันเกิด:</b> ${nhso ? (d.parseBirthDate||'-') : (d.birthdate ? d.birthdate.split('T')[0] : '-')}</div>
            <div style="margin-bottom:6px;"><span style="color:#6366f1;font-size:1.1em;">🚻</span> <b>เพศ:</b> ${nhso ? d.sexDesc : (d.gender||d['sex']||'-')}</b></div>
            <div style="margin-bottom:6px;"><span style="color:#6366f1;font-size:1.1em;">👩‍👦</span> <b>เลขบัตรแม่:</b> ${nhso ? (d.motherId||'-') : '-'}</div>
            <div style="margin-bottom:6px;"><span style="color:#6366f1;font-size:1.1em;">👨‍👦</span> <b>เลขบัตรพ่อ:</b> ${nhso ? (d.fatherId||'-') : '-'}</div>
            <div style="margin-bottom:6px;"><span style="color:#6366f1;font-size:1.1em;">✉️</span> <b>อีเมล:</b> ${nhso ? '-' : (d['contact-email'] ? d['contact-email'] : '-')}</div>
          </div>
          <div style="margin-bottom:18px;">
            <div style="font-size:1.1em;margin-bottom:8px;"><span style="color:#6366f1;">🏠</span> <b>ที่อยู่</b></div>
            <div style="margin-bottom:4px;">บ้านเลขที่: <b>${addr.number||'-'}</b> หมู่ <b>${addr.moo||'-'}</b></div>
            <div style="margin-bottom:4px;">อาคาร: <b>${addr.buildingName||'-'}</b></div>
            <div style="margin-bottom:4px;">ตำบล: <b>${addr.subDistrict||'-'}</b></div>
            <div style="margin-bottom:4px;">อำเภอ: <b>${addr.district||'-'}</b></div>
            <div style="margin-bottom:4px;">จังหวัด: <b>${addr.province||'-'}</b></div>
            <div>รหัสไปรษณีย์: <b>${addr.zip||'-'}</b></div>
          </div>
          <div style="margin-bottom:18px;">
            <div style="font-size:1.1em;margin-bottom:8px;"><span style="color:#6366f1;">📊</span> <b>สถานะ</b></div>
            <div style="margin-bottom:4px;">ระดับลูกค้า: <b>${nhso ? (data.mainInscl ? data.mainInscl.rightName : '-') : (d['customer-level']||d['inscl']||'-')}</b></div>
            <div style="margin-bottom:4px;">กลุ่มลูกค้า: <b>${nhso ? (data.subInscl ? data.subInscl.insclName : '-') : (d['customer-sublevel']||'-')}</b></div>
            <div style="margin-bottom:4px;">สถานะ: <b>${nhso ? (data.subInscl ? data.subInscl.codeWithName : '-') : (d['maininscl']||'-')}</b></div>
            <div>TRX-ID: <b>${nhso ? (data.id||'-') : (d['id']||'-')}</b></div>
          </div>
        </div>`;
        result.innerHTML = html;
        result.className = 'result-success';
        stopFakeProgress();
        if(progressPercent) progressPercent.textContent = ' 100%';

        // ปุ่ม copy
        const copyBtn = document.getElementById('copyResultBtn');
        if(copyBtn){
          const text = `ชื่อ: ${d.title||''} ${d.firstname||''} ${d.lastname||''}\nเลขบัตร: ${d['id-number']||'-'}\nวันเกิด: ${(d.birthdate||'-').split('T')[0]}\nเพศ: ${d.gender||'-'}\nอีเมล: ${d['contact-email']||'-'}\nเบอร์: ${d['contact-mobile-number']||d['contact-number']||'-'}\nที่อยู่: ${addr['number']||'-'} หมู่${addr['moo']||'-'} อาคาร:${addr['building-name']||'-'} ต.${addr['sub-district']||'-'} อ.${addr['district']||'-'} จ.${addr['province']||'-'} ${addr['zip']||'-'}\nระดับลูกค้า: ${d['customer-level']||'-'}\nกลุ่มลูกค้า: ${d['customer-sublevel']||'-'}\nสถานะ: ${(data.sff_result && data.sff_result.status) || '-'}\nTRX-ID: ${(data.sff_result && data.sff_result['trx-id']) || '-'}`;
          copyBtn.onclick = () => {
            navigator.clipboard.writeText(text);
            copyBtn.textContent = 'คัดลอกแล้ว';
            setTimeout(()=>{copyBtn.textContent='Copy';},1200);
          }
        }
      }

      searchHistory.push({
        query: val,
        status: status,
        note: note
      });
      renderHistory();

    } catch(err){
      result.textContent = 'เกิดข้อผิดพลาดในการเชื่อมต่อ API';
      result.className = 'result-error';
      stopFakeProgress();
      if(progressPercent) progressPercent.textContent = '';
      searchHistory.push({
        query: val,
        status: 'FAILED',
        note: 'เกิดข้อผิดพลาดในการเชื่อมต่อ API'
      });
      renderHistory();
      tableBody.innerHTML = '';
    }
  });
});