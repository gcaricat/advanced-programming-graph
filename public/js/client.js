
fetch('/config')
    .then(response => response.json())
    .then(config => {
        document.getElementById('login').addEventListener('click', function() {
            const tenantId = config.tenantId;
            const clientId = config.clientId;
            const redirectUri = encodeURIComponent(config.redirectUri);
            const scope = encodeURIComponent(config.scope);
            const authUrl = `http://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${scope}&response_mode=query`;
            window.location.href = authUrl;
        });
    })
    .catch(error => {
        console.error('Error fetching configuration:', error);
    });

