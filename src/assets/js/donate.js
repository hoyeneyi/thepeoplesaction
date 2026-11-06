// Donation form helpers. Payment itself is handled entirely by PayPal.
const form = document.querySelector('[data-donate-form]');
if (form) {
  const amount = form.querySelector('#dn-amount');
  const designation = form.querySelector('[data-designation]');
  const itemName = form.querySelector('[data-item-name]');

  // Preselect designation from ?designation=... (used by the Detroit Peoples Community page)
  const pre = new URLSearchParams(location.search).get('designation');
  if (pre && [...designation.options].some((o) => o.text === pre)) designation.value = pre;

  form.addEventListener('change', (e) => {
    if (e.target.name === 'preset') {
      amount.value = e.target.value;
      if (!e.target.value) amount.focus();
    }
  });
  amount.addEventListener('input', () => {
    const match = form.querySelector(`input[name="preset"][value="${CSS.escape(amount.value)}"]`);
    (match || form.querySelector('input[name="preset"][value=""]')).checked = true;
  });

  form.addEventListener('submit', (e) => {
    const v = amount.value.trim().replace(/^\$/, '');
    amount.value = v;
    if (v && !/^\d+(\.\d{1,2})?$/.test(v)) {
      e.preventDefault();
      amount.setAttribute('aria-invalid', 'true');
      amount.focus();
      return;
    }
    // The preset radios are UI only; don't send them to PayPal.
    form.querySelectorAll('input[name="preset"]').forEach((r) => { r.disabled = true; });
    itemName.value = `The Peoples Action — ${designation.value}`;
  });
  // Re-enable the amount buttons if the visitor comes back from PayPal (back/forward cache).
  addEventListener('pageshow', () => form.querySelectorAll('input[name="preset"]').forEach((r) => { r.disabled = false; }));
}
