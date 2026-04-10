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
            body: JSON.stringify({ email: email, password: password })
        });

        const text = await response.text();
        console.log('📊 Status:', response.status);
        console.log('📝 Response:', text);
        console.log('🔗 URL llamada:', `${API}/api/auth/login`);

        if (response.ok) {
            try {
                const data = JSON.parse(text);
                console.log('✅ Datos parseados:', data);
                
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify({
                    idUser:    data.idUser,
                    firstName: data.firstName,
                    lastName:  data.lastName,
                    role:      data.role
                }));
                showSuccess(`Welcome, ${data.firstName}. Redirecting...`);
                setTimeout(() => {
                    const rol = (data.role || '').toUpperCase();
                    console.log('🔄 Rol detectado:', rol);
                    if (rol === 'ADMIN')    { window.location.href = '../dashboard/dashboard.html';         return; }
                    if (rol === 'WAITER')   { window.location.href = '../waiter/dashboard/dashboard.html';  return; }
                    if (rol === 'CASHIER')  { window.location.href = '../cashier/dashboard/dashboard.html'; return; }
                    showError('Unknown role: ' + data.role);
                }, 1200);
            } catch (parseError) {
                console.error('❌ Error al parsear JSON:', parseError);
                console.error('Texto recibido:', text);
                showError('Error al procesar respuesta del servidor');
            }
        } else {
            console.error('❌ Error HTTP:', response.status);
            showError(text || 'Invalid credentials');
        }
    } catch (error) {
        console.error('❌ Error de conexión:', error.message);
        showError('Could not connect to the server. Verifica que el backend esté corriendo en http://127.0.0.1:8080');
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