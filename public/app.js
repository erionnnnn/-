(function () {
  const giftSelect = document.getElementById('giftId');
  const form = document.getElementById('surveyForm');
  const message = document.getElementById('formMessage');

  function showMessage(type, text) {
    message.textContent = text;
    message.className = `form-message ${type}`;
    message.classList.remove('visually-hidden');
  }

  function resetMessage() {
    message.textContent = '';
    message.className = 'form-message visually-hidden';
  }

  async function loadGifts() {
    try {
      const response = await fetch('/api/products');
      if (!response.ok) {
        throw new Error('Unable to load gifts.');
      }
      const payload = await response.json();
      const products = Array.isArray(payload.products) ? payload.products : [];
      giftSelect.innerHTML = '';
      if (products.length === 0) {
        giftSelect.disabled = true;
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No gifts available yet';
        giftSelect.appendChild(option);
        return;
      }

      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Select a gift';
      placeholder.disabled = true;
      placeholder.selected = true;
      giftSelect.appendChild(placeholder);

      for (const product of products) {
        const option = document.createElement('option');
        option.value = product.id;
        option.textContent = product.category
          ? `${product.name} — ${product.category}`
          : product.name;
        option.dataset.description = product.description || '';
        giftSelect.appendChild(option);
      }
      giftSelect.disabled = false;
    } catch (error) {
      giftSelect.innerHTML = '';
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Failed to load gifts';
      giftSelect.appendChild(option);
      giftSelect.disabled = true;
      showMessage('error', error.message || 'Failed to load gifts.');
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    resetMessage();
    if (!form.reportValidity()) {
      return;
    }

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    try {
      const response = await fetch('/api/submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit the survey.');
      }

      showMessage('success', result.message || 'Submission received!');
      form.reset();
      giftSelect.selectedIndex = 0;
    } catch (error) {
      showMessage('error', error.message || 'There was a problem submitting the survey.');
    }
  });

  loadGifts();
})();
