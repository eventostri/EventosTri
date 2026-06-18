(async () => {
  const gistUrl = 'https://gist.githubusercontent.com/alverpadilla/c49faeebe433ca13a6ddd54548e44980/raw/eventos.json';
  const nonceMeta = document.querySelector('meta[name="wp-rest-nonce"]');
  const nonce = nonceMeta ? nonceMeta.content : '';
  if (!nonce) throw new Error('REST nonce not found. Log in first.');

  const items = await fetch(gistUrl, { cache: 'no-store' }).then(r => {
    if (!r.ok) throw new Error('Could not read Gist JSON');
    return r.json();
  });

  const res = await fetch('/wp-json/eventostri/v1/eventos/sync', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-WP-Nonce': nonce
    },
    body: JSON.stringify(items)
  });

  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  console.log('Import OK:', data);
})();