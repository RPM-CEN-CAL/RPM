$ErrorActionPreference = 'Stop'

Write-Host "Installing RPM password reset system..." -ForegroundColor Cyan

$required = @('server.js', 'login.html', '.env')
foreach ($file in $required) {
  if (-not (Test-Path $file)) { throw "Missing required file: $file" }
}

Copy-Item server.js server.before-password-reset.js -Force
Copy-Item login.html login.before-password-reset.html -Force

@'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Forgot Password | RPM Equipment</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen flex items-center justify-center px-4">
  <div class="w-full max-w-md bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-2xl space-y-6">
    <div class="text-center">
      <h1 class="text-2xl font-extrabold text-white">Forgot Password</h1>
      <p class="text-sm text-slate-400 mt-2">Enter the email connected to your RPM account.</p>
    </div>

    <form id="requestForm" class="space-y-4">
      <div>
        <label class="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Email Address</label>
        <input id="email" type="email" required placeholder="name@company.com" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500">
      </div>
      <button id="submitBtn" type="submit" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg">Send Reset Email</button>
    </form>

    <p class="text-center text-xs text-slate-400"><a href="login.html" class="text-blue-400 font-semibold hover:underline">Return to Sign In</a></p>
  </div>

  <script>
    const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:3000'
      : 'https://rpm-qhrz.onrender.com';

    document.getElementById('requestForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = document.getElementById('submitBtn');
      button.disabled = true;
      button.textContent = 'Sending...';

      try {
        const response = await fetch(`${API_BASE_URL}/api/request-password-reset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: document.getElementById('email').value.trim().toLowerCase() })
        });
        const result = await response.json();
        alert(result.message || 'If the account exists, a reset email has been sent.');
      } catch (error) {
        alert('Unable to request a password reset. Please try again.');
      } finally {
        button.disabled = false;
        button.textContent = 'Send Reset Email';
      }
    });
  </script>
</body>
</html>
'@ | Set-Content forgot-password.html -Encoding UTF8

@'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Password | RPM Equipment</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen flex items-center justify-center px-4">
  <div class="w-full max-w-md bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-2xl space-y-6">
    <div class="text-center">
      <h1 class="text-2xl font-extrabold text-white">Create New Password</h1>
      <p class="text-sm text-slate-400 mt-2">Choose a password containing at least 8 characters.</p>
    </div>

    <form id="resetForm" class="space-y-4">
      <div>
        <label class="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">New Password</label>
        <div class="relative">
          <input id="password" type="password" required minlength="8" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 pr-12 text-sm text-white focus:outline-none focus:border-blue-500">
          <button type="button" onclick="togglePassword('password', this)" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white" aria-label="Show or hide password">&#128065;</button>
        </div>
      </div>

      <div>
        <label class="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Confirm New Password</label>
        <div class="relative">
          <input id="confirmPassword" type="password" required minlength="8" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 pr-12 text-sm text-white focus:outline-none focus:border-blue-500">
          <button type="button" onclick="togglePassword('confirmPassword', this)" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white" aria-label="Show or hide confirmed password">&#128065;</button>
        </div>
      </div>

      <button id="submitBtn" type="submit" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg">Update Password</button>
    </form>
  </div>

  <script>
    const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:3000'
      : 'https://rpm-qhrz.onrender.com';

    function togglePassword(inputId, button) {
      const input = document.getElementById(inputId);
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      button.innerHTML = showing ? '&#128065;' : '&#128584;';
    }

    document.getElementById('resetForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const token = new URLSearchParams(window.location.search).get('token');
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;

      if (!token) return alert('This password reset link is invalid.');
      if (password.length < 8) return alert('Password must contain at least 8 characters.');
      if (password !== confirmPassword) return alert('Passwords do not match.');

      const button = document.getElementById('submitBtn');
      button.disabled = true;
      button.textContent = 'Updating...';

      try {
        const response = await fetch(`${API_BASE_URL}/api/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, password })
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'Password reset failed.');
        alert('Password updated successfully. You can now sign in.');
        window.location.href = 'login.html';
      } catch (error) {
        alert(error.message || 'Password reset failed.');
      } finally {
        button.disabled = false;
        button.textContent = 'Update Password';
      }
    });
  </script>
</body>
</html>
'@ | Set-Content reset-password.html -Encoding UTF8

$login = Get-Content login.html -Raw
if ($login -notmatch 'forgot-password\.html') {
  $anchor = '    </form>'
  $addition = @'
      <div class="text-center pt-2">
        <a href="forgot-password.html" class="text-xs text-blue-400 font-semibold hover:underline">Forgot Password?</a>
      </div>
    </form>
'@
  if (-not $login.Contains($anchor)) { throw 'Could not find the login form closing tag.' }
  $login = $login.Replace($anchor, $addition)
  Set-Content login.html $login -Encoding UTF8
}

$server = Get-Content server.js -Raw
if ($server -notmatch "require\('nodemailer'\)") {
  $server = $server.Replace("const bcrypt = require('bcryptjs');", "const bcrypt = require('bcryptjs');`r`nconst nodemailer = require('nodemailer');")
}
if ($server -notmatch "require\('crypto'\)") {
  $server = $server.Replace("const bcrypt = require('bcryptjs');", "const bcrypt = require('bcryptjs');`r`nconst crypto = require('crypto');")
}

if ($server -notmatch "/api/request-password-reset") {
  $routes = @'

// Password Reset Email Request
app.post('/api/request-password-reset', async (req, res) => {
  const genericMessage = 'If the account exists, a password reset email has been sent.';

  try {
    const cleanEmail = String(req.body.email || '').toLowerCase().trim();
    if (!cleanEmail) return res.status(200).json({ success: true, message: genericMessage });

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (userError) throw userError;
    if (!user) return res.status(200).json({ success: true, message: genericMessage });

    await supabase
      .from('password_reset_tokens')
      .delete()
      .eq('user_id', user.id)
      .is('used_at', null);

    const rawToken = crypto.randomBytes(48).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const { error: tokenError } = await supabase
      .from('password_reset_tokens')
      .insert([{ user_id: user.id, token_hash: tokenHash, expires_at: expiresAt }]);

    if (tokenError) throw tokenError;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || 465),
      secure: String(process.env.SMTP_SECURE || 'true').toLowerCase() === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });

    const resetBaseUrl = process.env.PASSWORD_RESET_URL;
    if (!resetBaseUrl) throw new Error('PASSWORD_RESET_URL is not configured.');
    const resetUrl = `${resetBaseUrl}?token=${encodeURIComponent(rawToken)}`;

    await transporter.sendMail({
      from: `RPM Equipment <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: 'Reset your RPM Equipment password',
      text: `Use this secure link to reset your RPM Equipment password: ${resetUrl}\n\nThis link expires in 1 hour. If you did not request this change, ignore this email.`,
      html: `<p>A password reset was requested for your RPM Equipment account.</p><p><a href="${resetUrl}">Reset your password</a></p><p>This secure link expires in 1 hour. If you did not request this change, ignore this email.</p>`
    });

    return res.status(200).json({ success: true, message: genericMessage });
  } catch (error) {
    console.error('Password Reset Request Error:', error);
    return res.status(500).json({ success: false, message: 'Unable to send the password reset email.' });
  }
});

// Apply New Password
app.post('/api/reset-password', async (req, res) => {
  try {
    const token = String(req.body.token || '');
    const password = String(req.body.password || '');

    if (!token || password.length < 8) {
      return res.status(400).json({ success: false, message: 'A valid reset link and an 8-character password are required.' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const { data: resetRecord, error: resetError } = await supabase
      .from('password_reset_tokens')
      .select('id, user_id, expires_at, used_at')
      .eq('token_hash', tokenHash)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (resetError) throw resetError;
    if (!resetRecord) return res.status(400).json({ success: false, message: 'This password reset link is invalid or expired.' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const { error: updateError } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('id', resetRecord.user_id);

    if (updateError) throw updateError;

    await supabase
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', resetRecord.id);

    await supabase
      .from('auth_sessions')
      .delete()
      .eq('user_id', resetRecord.user_id);

    return res.status(200).json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Password Reset Error:', error);
    return res.status(500).json({ success: false, message: 'Unable to reset the password.' });
  }
});
'@

  $portAnchor = 'const PORT = process.env.PORT'
  $position = $server.IndexOf($portAnchor)
  if ($position -lt 0) { throw 'Could not find the server PORT section.' }
  $server = $server.Insert($position, $routes + "`r`n")
  Set-Content server.js $server -Encoding UTF8
}

node --check server.js
if ($LASTEXITCODE -ne 0) {
  Copy-Item server.before-password-reset.js server.js -Force
  Copy-Item login.before-password-reset.html login.html -Force
  throw 'server.js validation failed. Original files were restored.'
}

Write-Host "" 
Write-Host "Password reset installation completed." -ForegroundColor Green
Write-Host "Created: forgot-password.html"
Write-Host "Created: reset-password.html"
Write-Host "Updated: login.html"
Write-Host "Updated: server.js"
Write-Host "Backups were preserved."
