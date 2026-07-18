'use strict';

/* ============================================================
   حالة التطبيق و أدوات مساعدة
   ============================================================ */
const State = {
  token: localStorage.getItem('token') || null,
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  tab: null,
};

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v != null && v !== false) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
};

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (m) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

function fmtDate(s) {
  if (!s) return '';
  // SQLite datetime('now') يعيد UTC — نضيف Z ليُفسَّر صحيحاً
  const d = new Date(s.replace(' ', 'T') + 'Z');
  if (isNaN(d)) return s;
  return d.toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' });
}

let toastTimer;
function toast(msg, type = '') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast' + (type ? ' ' + type : '');
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 3200);
}

/* ============================================================
   طبقة الاتصال بالـ API
   ============================================================ */
async function api(path, { method = 'GET', body, isForm } = {}) {
  const headers = {};
  if (State.token) headers.Authorization = 'Bearer ' + State.token;
  if (body && !isForm) headers['Content-Type'] = 'application/json';
  const res = await fetch('/api' + path, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch (_) { /* no body */ }
  if (res.status === 401) { doLogout(true); throw new Error((data && data.error) || 'انتهت الجلسة'); }
  if (!res.ok) throw new Error((data && data.error) || 'حدث خطأ');
  return data;
}

async function openAttachment(id) {
  try {
    const res = await fetch('/api/attachments/' + id, {
      headers: { Authorization: 'Bearer ' + State.token },
    });
    if (!res.ok) throw new Error('تعذّر فتح المرفق');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) {
    toast(e.message, 'err');
  }
}

/* ============================================================
   الجلسة
   ============================================================ */
function setSession(token, user) {
  State.token = token;
  State.user = user;
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}
function doLogout(silent) {
  State.token = null; State.user = null; State.tab = null;
  localStorage.removeItem('token'); localStorage.removeItem('user');
  if (!silent) render();
  else render();
}

/* ============================================================
   نافذة منبثقة
   ============================================================ */
function openModal(contentNode) {
  const card = $('#modal-card');
  card.innerHTML = '';
  card.appendChild(contentNode);
  $('#modal').hidden = false;
}
function closeModal() { $('#modal').hidden = true; $('#modal-card').innerHTML = ''; }
$('#modal').addEventListener('click', (e) => { if (e.target.dataset.close != null) closeModal(); });

/* ============================================================
   شاشة الدخول / التسجيل
   ============================================================ */
function renderAuth() {
  const app = $('#app');
  app.innerHTML = '';
  let mode = 'login';

  const wrap = el('div', { class: 'auth-wrap' });
  const card = el('div', { class: 'auth-card' });

  const logo = el('div', { class: 'auth-logo' }, [
    el('div', { class: 'badge' }, '⛺'),
    el('h1', {}, 'تقييم المخيمات'),
    el('p', {}, 'منصة التقييم والبلاغات الميدانية'),
  ]);

  const switcher = el('div', { class: 'switcher' });
  const btnLogin = el('button', { class: 'active' }, 'تسجيل الدخول');
  const btnReg = el('button', {}, 'حساب مشرف جديد');
  switcher.append(btnLogin, btnReg);

  const formHost = el('div', {});

  function paintForm() {
    formHost.innerHTML = '';
    btnLogin.classList.toggle('active', mode === 'login');
    btnReg.classList.toggle('active', mode === 'register');

    const fields = [];
    if (mode === 'register') {
      fields.push(field('الاسم الكامل', el('input', { id: 'f-name', type: 'text', placeholder: 'مثال: خالد المطيري', required: true })));
    }
    fields.push(field('اسم المستخدم', el('input', { id: 'f-username', type: 'text', autocomplete: 'username', required: true })));
    fields.push(field('كلمة المرور', el('input', { id: 'f-password', type: 'password', autocomplete: mode === 'login' ? 'current-password' : 'new-password', required: true })));

    const submit = el('button', { class: 'btn block', type: 'submit' }, mode === 'login' ? 'دخول' : 'إنشاء الحساب');
    const form = el('form', { onsubmit: onSubmit }, [...fields, submit]);
    formHost.appendChild(form);

    if (mode === 'login') {
      formHost.appendChild(el('p', { class: 'hint', style: 'text-align:center;margin-top:14px' },
        'حساب المشرف: أنشئ حساباً جديداً. حساب المدير يُزوَّد من إدارة النظام.'));
    }

    async function onSubmit(e) {
      e.preventDefault();
      const btn = e.submitter || submit;
      btn.disabled = true;
      try {
        const payload = {
          username: $('#f-username').value.trim(),
          password: $('#f-password').value,
        };
        if (mode === 'register') payload.name = $('#f-name').value.trim();
        const data = await api('/auth/' + (mode === 'login' ? 'login' : 'register'), { method: 'POST', body: payload });
        setSession(data.token, data.user);
        toast('مرحباً ' + data.user.name, 'ok');
        render();
      } catch (err) {
        toast(err.message, 'err');
        btn.disabled = false;
      }
    }
  }

  btnLogin.onclick = () => { mode = 'login'; paintForm(); };
  btnReg.onclick = () => { mode = 'register'; paintForm(); };

  card.append(logo, switcher, formHost);
  wrap.appendChild(card);
  app.appendChild(wrap);
  paintForm();
}

function field(label, input, opts = {}) {
  return el('div', { class: 'field' }, [
    el('label', {}, [label, opts.optional ? '' : el('span', { class: 'req' }, ' *')]),
    input,
    opts.hint ? el('div', { class: 'hint' }, opts.hint) : null,
  ]);
}

/* ============================================================
   الهيكل الرئيسي (رأس + محتوى + شريط التبويب)
   ============================================================ */
function shell(tabs) {
  const app = $('#app');
  app.innerHTML = '';

  const header = el('header', { class: 'app-header' }, [
    el('div', {}, [
      el('h1', {}, ['⛺ تقييم المخيمات']),
      el('div', { class: 'who' }, `${State.user.name} · ${State.user.role === 'manager' ? 'مدير' : 'مشرف'}`),
    ]),
    el('div', { class: 'header-actions' }, [
      el('button', { class: 'link-btn', onclick: () => { if (confirm('تسجيل الخروج؟')) doLogout(); } }, 'خروج'),
    ]),
  ]);

  const container = el('div', { class: 'container', id: 'view' });

  const tabbar = el('nav', { class: 'tabbar' });
  for (const t of tabs) {
    const b = el('button', { class: State.tab === t.id ? 'active' : '', onclick: () => { State.tab = t.id; renderTab(tabs); } }, [
      el('span', { class: 'ic' }, t.icon),
      el('span', {}, t.label),
    ]);
    tabbar.appendChild(b);
  }

  app.append(header, container, tabbar);
  renderTab(tabs);
}

function renderTab(tabs) {
  const t = tabs.find((x) => x.id === State.tab) || tabs[0];
  State.tab = t.id;
  document.querySelectorAll('.tabbar button').forEach((b, i) => b.classList.toggle('active', tabs[i].id === t.id));
  const view = $('#view');
  view.innerHTML = '';
  view.appendChild(el('div', { class: 'center-spin' }, el('div', { class: 'spinner' })));
  t.render(view);
}

function loading(view) {
  view.innerHTML = '';
  view.appendChild(el('div', { class: 'center-spin' }, el('div', { class: 'spinner' })));
}
function emptyState(icon, text) {
  return el('div', { class: 'empty' }, [el('span', { class: 'ic' }, icon), el('div', {}, text)]);
}

/* ============================================================
   المشرف — نموذج تقييم جديد
   ============================================================ */
async function viewNewAssessment(view) {
  loading(view);
  let criteria;
  try { criteria = (await api('/criteria')).criteria; }
  catch (e) { view.innerHTML = ''; view.appendChild(errorCard(e.message)); return; }

  view.innerHTML = '';
  if (!criteria.length) {
    view.appendChild(el('div', { class: 'card' }, [
      el('h2', {}, 'تقييم جديد'),
      emptyState('📋', 'لا توجد بنود تقييم مُعرّفة بعد. يقوم المدير بإضافتها.'),
    ]));
    return;
  }

  const card = el('div', { class: 'card' }, [
    el('h2', {}, 'تقييم مخيم جديد'),
    el('p', { class: 'sub' }, 'حدّد حالة كل بند وأرفق صورة/مستند إلزامي لكل بند.'),
  ]);

  const campInput = el('input', { id: 'a-camp', type: 'text', placeholder: 'اسم أو رقم المخيم', required: true });
  card.appendChild(field('المخيم', campInput));

  const itemsHost = el('div', {});
  const itemRefs = [];
  criteria.forEach((c, idx) => {
    const fieldName = 'file_' + idx;
    const nameYes = 'avail_' + idx;
    const fileNameLabel = el('span', { class: 'file-name' }, 'لم يتم الإرفاق');
    const fileInput = el('input', {
      type: 'file', name: fieldName, accept: 'image/*,application/pdf',
      onchange: (e) => {
        const f = e.target.files[0];
        fileNameLabel.textContent = f ? f.name : 'لم يتم الإرفاق';
        fileNameLabel.classList.toggle('file-ok', !!f);
      },
    });

    const row = el('div', { class: 'crit-item' }, [
      el('div', { class: 'crit-name' }, ['🔹 ', c.name]),
      el('div', { class: 'avail-toggle' }, [
        el('label', { class: 'on-yes' }, [el('input', { type: 'radio', name: nameYes, value: '1', required: true }), el('span', {}, '✅ متوفر')]),
        el('label', { class: 'on-no' }, [el('input', { type: 'radio', name: nameYes, value: '0', required: true }), el('span', {}, '❌ غير متوفر')]),
      ]),
      el('div', { class: 'file-input-row' }, [
        el('label', { class: 'file-label' }, ['📎 إرفاق ملف', fileInput]),
        fileNameLabel,
      ]),
      el('input', { class: 'note-in', type: 'text', placeholder: 'ملاحظة (اختياري)', style: 'margin-top:8px' }),
    ]);
    itemRefs.push({ c, idx, fieldName, nameYes, fileInput, noteInput: row.querySelector('.note-in') });
    itemsHost.appendChild(row);
  });

  const notesInput = el('textarea', { id: 'a-notes', placeholder: 'ملاحظات عامة على المخيم (اختياري)' });
  const submitBtn = el('button', { class: 'btn block', type: 'submit' }, '💾 حفظ التقييم');

  const form = el('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      const camp = campInput.value.trim();
      if (!camp) return toast('اسم المخيم مطلوب', 'err');

      const fd = new FormData();
      fd.append('camp_name', camp);
      fd.append('notes', notesInput.value.trim());
      const payload = [];
      for (const r of itemRefs) {
        const checked = form.querySelector(`input[name="${r.nameYes}"]:checked`);
        if (!checked) return toast(`حدّد حالة التوفر للبند: ${r.c.name}`, 'err');
        if (!r.fileInput.files[0]) return toast(`المرفق إلزامي للبند: ${r.c.name}`, 'err');
        fd.append(r.fieldName, r.fileInput.files[0]);
        payload.push({
          criterion_id: r.c.id,
          criterion_name: r.c.name,
          available: Number(checked.value),
          note: r.noteInput.value.trim(),
          file_field: r.fieldName,
        });
      }
      fd.append('payload', JSON.stringify(payload));

      submitBtn.disabled = true; submitBtn.textContent = 'جارٍ الحفظ...';
      try {
        await api('/assessments', { method: 'POST', body: fd, isForm: true });
        toast('تم حفظ التقييم بنجاح', 'ok');
        State.tab = 'a-history';
        renderApp();
      } catch (err) {
        toast(err.message, 'err');
        submitBtn.disabled = false; submitBtn.textContent = '💾 حفظ التقييم';
      }
    },
  }, [itemsHost, el('div', { class: 'divider' }), field('ملاحظات عامة', notesInput, { optional: true }), submitBtn]);

  card.appendChild(form);
  view.appendChild(card);
}

/* ============================================================
   المشرف — بلاغ جديد
   ============================================================ */
const REPORT_CATEGORIES = ['كهرباء', 'مياه', 'صرف صحي', 'نظافة', 'سلامة', 'صيانة', 'أمن', 'أخرى'];

function viewNewReport(view) {
  view.innerHTML = '';
  const card = el('div', { class: 'card' }, [
    el('h2', {}, 'رفع بلاغ جديد'),
    el('p', { class: 'sub' }, 'سجّل أي عطل أو ملاحظة في المخيم (مثال: عطل كهرباء).'),
  ]);

  const title = el('input', { type: 'text', placeholder: 'عنوان مختصر للبلاغ' });
  const cat = el('select', {}, [
    el('option', { value: '' }, 'اختر التصنيف'),
    ...REPORT_CATEGORIES.map((c) => el('option', { value: c }, c)),
  ]);
  const desc = el('textarea', { placeholder: 'وصف تفصيلي للمشكلة' });
  const fileNameLabel = el('span', { class: 'file-name' }, 'لا يوجد مرفق');
  const fileInput = el('input', {
    type: 'file', accept: 'image/*,application/pdf',
    onchange: (e) => {
      const f = e.target.files[0];
      fileNameLabel.textContent = f ? f.name : 'لا يوجد مرفق';
      fileNameLabel.classList.toggle('file-ok', !!f);
    },
  });
  const submitBtn = el('button', { class: 'btn block', type: 'submit' }, '📤 إرسال البلاغ');

  const form = el('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      if (!title.value.trim()) return toast('العنوان مطلوب', 'err');
      if (!cat.value) return toast('التصنيف مطلوب', 'err');
      if (!desc.value.trim()) return toast('الوصف مطلوب', 'err');
      const fd = new FormData();
      fd.append('title', title.value.trim());
      fd.append('category', cat.value);
      fd.append('description', desc.value.trim());
      if (fileInput.files[0]) fd.append('attachment', fileInput.files[0]);
      submitBtn.disabled = true; submitBtn.textContent = 'جارٍ الإرسال...';
      try {
        await api('/reports', { method: 'POST', body: fd, isForm: true });
        toast('تم إرسال البلاغ', 'ok');
        State.tab = 'r-history';
        renderApp();
      } catch (err) {
        toast(err.message, 'err');
        submitBtn.disabled = false; submitBtn.textContent = '📤 إرسال البلاغ';
      }
    },
  }, [
    field('عنوان البلاغ', title),
    field('التصنيف', cat),
    field('الوصف', desc),
    field('مرفق (اختياري)', el('div', { class: 'file-input-row' }, [
      el('label', { class: 'file-label' }, ['📎 إرفاق ملف', fileInput]),
      fileNameLabel,
    ]), { optional: true }),
    submitBtn,
  ]);

  card.appendChild(form);
  view.appendChild(card);
}

/* ============================================================
   سجلات (تقييمات / بلاغات) — مشترك
   ============================================================ */
async function viewAssessmentsList(view, { manager } = {}) {
  loading(view);
  let list;
  try { list = (await api('/assessments')).assessments; }
  catch (e) { view.innerHTML = ''; view.appendChild(errorCard(e.message)); return; }
  view.innerHTML = '';
  view.appendChild(el('div', { class: 'section-title' }, manager ? 'كل التقييمات' : 'سجل تقييماتي'));
  if (!list.length) { view.appendChild(emptyState('📋', 'لا توجد تقييمات بعد.')); return; }
  for (const a of list) {
    view.appendChild(el('div', {
      class: 'list-item', onclick: () => showAssessmentDetail(a.id),
    }, [
      el('div', { class: 'li-top' }, [
        el('div', { class: 'li-title' }, '⛺ ' + a.camp_name),
        el('span', { class: 'badge-pill pill-yes' }, `${a.available_count}/${a.items_count} متوفر`),
      ]),
      el('div', { class: 'li-meta' }, [
        el('span', {}, '🗓 ' + fmtDate(a.created_at)),
        manager ? el('span', {}, '👤 ' + a.supervisor_name) : null,
      ]),
    ]));
  }
}

async function showAssessmentDetail(id) {
  try {
    const { assessment, items } = await api('/assessments/' + id);
    const card = el('div', {});
    card.appendChild(el('h3', {}, '⛺ ' + assessment.camp_name));
    card.appendChild(el('div', { class: 'detail-row' }, [el('span', { class: 'k' }, 'المشرف'), el('span', { class: 'v' }, assessment.supervisor_name)]));
    card.appendChild(el('div', { class: 'detail-row' }, [el('span', { class: 'k' }, 'التاريخ'), el('span', { class: 'v' }, fmtDate(assessment.created_at))]));
    if (assessment.notes) card.appendChild(el('div', { class: 'detail-row' }, [el('span', { class: 'k' }, 'ملاحظات'), el('span', { class: 'v' }, assessment.notes)]));

    card.appendChild(el('div', { class: 'section-title', style: 'margin-top:14px' }, 'البنود'));
    for (const it of items) {
      card.appendChild(el('div', { class: 'crit-item' }, [
        el('div', { class: 'li-top' }, [
          el('div', { class: 'crit-name' }, it.criterion_name),
          el('span', { class: 'badge-pill ' + (it.available ? 'pill-yes' : 'pill-no') }, it.available ? 'متوفر' : 'غير متوفر'),
        ]),
        it.note ? el('div', { class: 'hint' }, '📝 ' + it.note) : null,
        el('button', { class: 'thumb-link', style: 'margin-top:6px', onclick: () => openAttachment(it.attachment_id) }, ['📎 عرض المرفق']),
      ]));
    }
    card.appendChild(el('button', { class: 'btn ghost block', style: 'margin-top:14px', 'data-close': '1', onclick: closeModal }, 'إغلاق'));
    openModal(card);
  } catch (e) { toast(e.message, 'err'); }
}

async function viewReportsList(view, { manager } = {}) {
  loading(view);
  let statusFilter = view._statusFilter || '';
  const load = async () => {
    let list;
    try { list = (await api('/reports' + (statusFilter ? '?status=' + statusFilter : ''))).reports; }
    catch (e) { view.innerHTML = ''; view.appendChild(errorCard(e.message)); return; }
    view.innerHTML = '';
    view.appendChild(el('div', { class: 'section-title' }, manager ? 'كل البلاغات' : 'سجل بلاغاتي'));

    const filters = el('div', { class: 'filters' });
    [['', 'الكل'], ['open', 'مفتوحة'], ['done', 'تمّت']].forEach(([val, lbl]) => {
      filters.appendChild(el('button', {
        class: 'chip' + (statusFilter === val ? ' active' : ''),
        onclick: () => { statusFilter = val; view._statusFilter = val; load(); },
      }, lbl));
    });
    view.appendChild(filters);

    if (!list.length) { view.appendChild(emptyState('📮', 'لا توجد بلاغات.')); return; }
    for (const r of list) {
      view.appendChild(el('div', {
        class: 'list-item', onclick: () => showReportDetail(r.id, { manager, onChange: load }),
      }, [
        el('div', { class: 'li-top' }, [
          el('div', { class: 'li-title' }, r.title),
          el('span', { class: 'badge-pill ' + (r.status === 'done' ? 'pill-done' : 'pill-open') }, r.status === 'done' ? '✔ تمّت' : '● مفتوح'),
        ]),
        el('div', { class: 'li-meta' }, [
          el('span', {}, '🏷 ' + r.category),
          el('span', {}, '🗓 ' + fmtDate(r.created_at)),
          manager ? el('span', {}, '👤 ' + r.supervisor_name) : null,
        ]),
      ]));
    }
  };
  await load();
}

async function showReportDetail(id, { manager, onChange } = {}) {
  try {
    const { report: r } = await api('/reports/' + id);
    const card = el('div', {});
    card.appendChild(el('h3', {}, r.title));
    card.appendChild(el('div', { class: 'detail-row' }, [el('span', { class: 'k' }, 'الحالة'),
      el('span', { class: 'v' }, el('span', { class: 'badge-pill ' + (r.status === 'done' ? 'pill-done' : 'pill-open') }, r.status === 'done' ? '✔ تمّت' : '● مفتوح'))]));
    card.appendChild(el('div', { class: 'detail-row' }, [el('span', { class: 'k' }, 'التصنيف'), el('span', { class: 'v' }, r.category)]));
    card.appendChild(el('div', { class: 'detail-row' }, [el('span', { class: 'k' }, 'المشرف'), el('span', { class: 'v' }, r.supervisor_name)]));
    card.appendChild(el('div', { class: 'detail-row' }, [el('span', { class: 'k' }, 'التاريخ'), el('span', { class: 'v' }, fmtDate(r.created_at))]));
    card.appendChild(el('div', { class: 'detail-row' }, [el('span', { class: 'k' }, 'الوصف'), el('span', { class: 'v', style: 'max-width:60%' }, r.description)]));
    if (r.status === 'done') {
      card.appendChild(el('div', { class: 'detail-row' }, [el('span', { class: 'k' }, 'أُغلق بواسطة'), el('span', { class: 'v' }, (r.closed_by_name || '') + ' · ' + fmtDate(r.closed_at))]));
    }
    if (r.attachment_id) {
      card.appendChild(el('button', { class: 'thumb-link', style: 'margin-top:10px', onclick: () => openAttachment(r.attachment_id) }, '📎 عرض المرفق'));
    }

    const actions = el('div', { style: 'margin-top:16px;display:flex;gap:8px' });
    if (manager) {
      if (r.status === 'open') {
        actions.appendChild(el('button', { class: 'btn success', style: 'flex:1', onclick: async () => {
          try { await api('/reports/' + id + '/close', { method: 'PUT' }); toast('تم إغلاق البلاغ (تمّت)', 'ok'); closeModal(); onChange && onChange(); }
          catch (e) { toast(e.message, 'err'); }
        } }, '✔ وضع البلاغ كـ "تمّت"'));
      } else {
        actions.appendChild(el('button', { class: 'btn ghost', style: 'flex:1', onclick: async () => {
          try { await api('/reports/' + id + '/reopen', { method: 'PUT' }); toast('تم إعادة فتح البلاغ', 'ok'); closeModal(); onChange && onChange(); }
          catch (e) { toast(e.message, 'err'); }
        } }, '↩ إعادة فتح'));
      }
    }
    actions.appendChild(el('button', { class: 'btn ghost', onclick: closeModal }, 'إغلاق'));
    card.appendChild(actions);
    openModal(card);
  } catch (e) { toast(e.message, 'err'); }
}

/* ============================================================
   المدير — لوحة التحكم
   ============================================================ */
async function viewDashboard(view) {
  loading(view);
  let data;
  try { data = await api('/stats'); }
  catch (e) { view.innerHTML = ''; view.appendChild(errorCard(e.message)); return; }
  view.innerHTML = '';
  const s = data.stats;

  view.appendChild(el('div', { class: 'section-title' }, 'لوحة التحكم'));
  const grid = el('div', { class: 'stats-grid' }, [
    statCard(s.totalAssessments, 'إجمالي التقييمات', 'accent-primary'),
    statCard(s.totalReports, 'إجمالي البلاغات', ''),
    statCard(s.openReports, 'بلاغات مفتوحة', 'accent-open'),
    statCard(s.doneReports, 'بلاغات تمّت', 'accent-done'),
  ]);
  view.appendChild(grid);
  view.appendChild(el('div', { class: 'card' }, [
    el('div', { class: 'detail-row' }, [el('span', { class: 'k' }, 'عدد المشرفين المسجّلين'), el('span', { class: 'v' }, String(s.supervisors))]),
  ]));

  // البلاغات حسب التصنيف
  if (data.reportsByCategory.length) {
    const maxCat = Math.max(...data.reportsByCategory.map((x) => x.c), 1);
    const catCard = el('div', { class: 'card' }, [el('h2', {}, 'البلاغات حسب التصنيف')]);
    for (const row of data.reportsByCategory) {
      catCard.appendChild(el('div', { class: 'bar-row' }, [
        el('div', { class: 'bar-label' }, [el('span', {}, row.category), el('span', {}, String(row.c))]),
        el('div', { class: 'bar-track' }, el('div', { class: 'bar-fill', style: `width:${(row.c / maxCat) * 100}%` })),
      ]));
    }
    view.appendChild(catCard);
  }

  // نسبة توفر البنود
  if (data.availability.length) {
    const availCard = el('div', { class: 'card' }, [el('h2', {}, 'نسبة توفّر البنود عبر التقييمات')]);
    for (const row of data.availability) {
      const pct = Math.round((row.available_count / row.total) * 100);
      availCard.appendChild(el('div', { class: 'bar-row' }, [
        el('div', { class: 'bar-label' }, [el('span', {}, row.name), el('span', {}, pct + '%')]),
        el('div', { class: 'bar-track' }, el('div', { class: 'bar-fill', style: `width:${pct}%;background:${pct >= 50 ? 'var(--success)' : 'var(--danger)'}` })),
      ]));
    }
    view.appendChild(availCard);
  }
}

function statCard(num, lbl, cls) {
  return el('div', { class: 'stat ' + cls }, [
    el('div', { class: 'num' }, String(num)),
    el('div', { class: 'lbl' }, lbl),
  ]);
}

/* ============================================================
   المدير — إدارة البنود
   ============================================================ */
async function viewManageCriteria(view) {
  loading(view);
  const load = async () => {
    let list;
    try { list = (await api('/criteria?all=1')).criteria; }
    catch (e) { view.innerHTML = ''; view.appendChild(errorCard(e.message)); return; }
    view.innerHTML = '';
    view.appendChild(el('div', { class: 'section-title' }, 'إدارة بنود التقييم'));

    // نموذج إضافة
    const addInput = el('input', { type: 'text', placeholder: 'اسم البند الجديد' });
    const addForm = el('form', {
      onsubmit: async (e) => {
        e.preventDefault();
        if (!addInput.value.trim()) return;
        try { await api('/criteria', { method: 'POST', body: { name: addInput.value.trim() } }); toast('تمت الإضافة', 'ok'); addInput.value = ''; load(); }
        catch (err) { toast(err.message, 'err'); }
      },
    }, [
      el('div', { style: 'display:flex;gap:8px' }, [
        el('div', { style: 'flex:1' }, addInput),
        el('button', { class: 'btn', type: 'submit' }, '➕ إضافة'),
      ]),
    ]);
    view.appendChild(el('div', { class: 'card' }, [el('h2', {}, 'إضافة بند'), el('p', { class: 'sub' }, 'ستظهر البنود الفعّالة في نموذج تقييم المشرف.'), addForm]));

    if (!list.length) { view.appendChild(emptyState('📋', 'لا توجد بنود.')); return; }
    const listCard = el('div', { class: 'card' }, [el('h2', {}, 'البنود الحالية')]);
    for (const c of list) {
      const row = el('div', { class: 'crit-item', style: 'margin-bottom:8px' }, [
        el('div', { class: 'li-top' }, [
          el('div', { class: 'crit-name' }, [c.active ? '🔹 ' : '⚪ ', c.name, c.active ? '' : el('span', { class: 'badge-pill pill-no', style: 'margin-inline-start:8px' }, 'معطّل')]),
          el('div', { style: 'display:flex;gap:6px' }, [
            el('button', { class: 'btn ghost sm', onclick: () => editCriterion(c, load) }, '✏️'),
            el('button', { class: 'btn ' + (c.active ? 'ghost' : 'success') + ' sm', onclick: async () => {
              try { await api('/criteria/' + c.id, { method: 'PUT', body: { active: c.active ? 0 : 1 } }); load(); }
              catch (e) { toast(e.message, 'err'); }
            } }, c.active ? '🚫 تعطيل' : '✅ تفعيل'),
            el('button', { class: 'btn danger sm', onclick: async () => {
              if (!confirm('حذف البند؟ (سيُعطَّل إن كان مستخدماً في تقييمات سابقة)')) return;
              try { const r = await api('/criteria/' + c.id, { method: 'DELETE' }); toast(r.deleted ? 'تم الحذف' : 'تم التعطيل (مستخدم سابقاً)', 'ok'); load(); }
              catch (e) { toast(e.message, 'err'); }
            } }, '🗑'),
          ]),
        ]),
      ]);
      listCard.appendChild(row);
    }
    view.appendChild(listCard);
  };
  await load();
}

function editCriterion(c, onDone) {
  const input = el('input', { type: 'text', value: c.name });
  const card = el('div', {}, [
    el('h3', {}, 'تعديل البند'),
    field('اسم البند', input),
    el('div', { style: 'display:flex;gap:8px' }, [
      el('button', { class: 'btn', style: 'flex:1', onclick: async () => {
        if (!input.value.trim()) return;
        try { await api('/criteria/' + c.id, { method: 'PUT', body: { name: input.value.trim() } }); toast('تم التعديل', 'ok'); closeModal(); onDone(); }
        catch (e) { toast(e.message, 'err'); }
      } }, 'حفظ'),
      el('button', { class: 'btn ghost', onclick: closeModal }, 'إلغاء'),
    ]),
  ]);
  openModal(card);
}

/* ============================================================
   أدوات عرض
   ============================================================ */
function errorCard(msg) {
  return el('div', { class: 'card' }, [emptyState('⚠️', msg || 'حدث خطأ')]);
}

/* ============================================================
   الموجّه الرئيسي
   ============================================================ */
function renderApp() {
  if (State.user.role === 'manager') {
    shell([
      { id: 'dashboard', label: 'اللوحة', icon: '📊', render: viewDashboard },
      { id: 'm-reports', label: 'البلاغات', icon: '📮', render: (v) => viewReportsList(v, { manager: true }) },
      { id: 'm-assess', label: 'التقييمات', icon: '📋', render: (v) => viewAssessmentsList(v, { manager: true }) },
      { id: 'criteria', label: 'البنود', icon: '⚙️', render: viewManageCriteria },
    ]);
  } else {
    shell([
      { id: 'new-assess', label: 'تقييم', icon: '📝', render: viewNewAssessment },
      { id: 'new-report', label: 'بلاغ', icon: '➕', render: viewNewReport },
      { id: 'a-history', label: 'التقييمات', icon: '📋', render: (v) => viewAssessmentsList(v, {}) },
      { id: 'r-history', label: 'البلاغات', icon: '📮', render: (v) => viewReportsList(v, {}) },
    ]);
  }
}

function render() {
  closeModal();
  if (!State.token || !State.user) renderAuth();
  else renderApp();
}

// تحقق من صلاحية الجلسة عند البدء
async function boot() {
  if (State.token) {
    try { const { user } = await api('/auth/me'); State.user = user; localStorage.setItem('user', JSON.stringify(user)); }
    catch (_) { doLogout(true); return; }
  }
  render();
}

// تسجيل الـ service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/service-worker.js').catch(() => {}));
}

boot();
