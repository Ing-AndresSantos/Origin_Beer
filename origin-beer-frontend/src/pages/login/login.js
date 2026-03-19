const API = 'http://127.0.0.1:8080';

document.getElementById('password').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') login();
});

async function login() {
    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    const btn      = document.getElementById('btnLogin');
    const msg      = document.getElementById('message');

    msg.className = 'message';
    msg.textContent = '';

    if (!email || !password) {
        showError('Please fill in all fields');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Verifying...';

    try {
        const response = await fetch(`${API}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ correo: email, contrasena: password })
        });

        const text = await response.text();
        console.log('Status:', response.status);
        console.log('Response:', text);

        if (response.ok) {
            const data = JSON.parse(text);
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify({
                nombre:   data.nombre,
                apellido: data.apellido,
                rol:      data.rol
            }));
            showSuccess(`Welcome, ${data.nombre}. Redirecting...`);
            setTimeout(() => {
                window.location.href = '../dashboard/dashboard.html';
            }, 1500);
        } else {
            showError(text || 'Invalid credentials');
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Could not connect to the server');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Sign In';
    }
}

function showError(msg) {
    const el = document.getElementById('message');
    el.className = 'message error';
    el.textContent = msg;
}

function showSuccess(msg) {
    const el = document.getElementById('message');
    el.className = 'message success';
    el.textContent = msg;
}
