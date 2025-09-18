(function () {
  const form = document.getElementById('uploadForm');
  const fileInput = document.getElementById('giftFile');
  const message = document.getElementById('uploadMessage');

  function showMessage(type, text) {
    message.textContent = text;
    message.className = `form-message ${type}`;
    message.classList.remove('visually-hidden');
  }

  function resetMessage() {
    message.textContent = '';
    message.className = 'form-message visually-hidden';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    resetMessage();

    if (!fileInput.files || fileInput.files.length === 0) {
      showMessage('error', 'Please choose a file to upload.');
      return;
    }

    const data = new FormData();
    data.append('file', fileInput.files[0]);

    try {
      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        body: data,
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Upload failed.');
      }
      showMessage('success', result.message || 'Upload successful.');
      form.reset();
    } catch (error) {
      showMessage('error', error.message || 'There was a problem uploading the file.');
    }
  });
})();
