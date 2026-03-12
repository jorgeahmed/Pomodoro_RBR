import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Usa tu dominio verificado leyendo la variable de entorno RESEND_FROM_EMAIL, o usa el dummy si no existe.
const FROM = process.env.RESEND_FROM_EMAIL || 'Syncro-Daily <onboarding@resend.dev>';

export async function sendDailyReport({ to, name, reportHtml, date }) {
  return resend.emails.send({
    from: FROM,
    to,
    subject: `⚡ Tu Plan del Día — ${date}`,
    html: reportHtml,
  });
}

export async function sendDelegationEmail({ to, taskText, fromUser }) {
  return resend.emails.send({
    from: FROM,
    to,
    subject: `📌 Tarea delegada: ${taskText.substring(0, 40)}...`,
    html: `
        <div style="font-family: Inter, system-ui, sans-serif; max-width:600px; margin:0 auto; padding:32px 16px; background:#0f1623; color:#fff;">
          <h2 style="color:#e2e8f0; margin-bottom:8px;">📌 Tarea Delegada</h2>
          <p style="color:#94a3b8; font-size:14px;"><strong>${fromUser}</strong> te ha asignado la siguiente actividad desde Pomodoro ReBorder:</p>
          <div style="background:#161d2e; padding:20px; border-radius:12px; border:1px solid #1e2a40; margin:24px 0;">
            <p style="font-size:16px; margin:0; color:#e2e8f0; font-weight:bold;">${taskText}</p>
          </div>
          <p style="color:#64748b; font-size:12px;">¡Mucho éxito completándola!</p>
        </div>
        `
  });
}

export function buildReportHtml({ name, date, tasks, schedule }) {
  const quadrantColors = {
    'DO FIRST': '#ef4444', 'SCHEDULE': '#3b82f6',
    'DELEGATE': '#f59e0b', 'ELIMINATE': '#6b7280',
  };

  const taskRows = tasks.map(t => `
    <tr style="border-bottom:1px solid #1e2a40">
      <td style="padding:10px 12px;color:#e2e8f0;font-size:14px">${t.text}</td>
      <td style="padding:10px 12px;text-align:center">
        <span style="background:${quadrantColors[t.quadrant] || '#6b7280'}22;color:${quadrantColors[t.quadrant] || '#6b7280'};border:1px solid ${quadrantColors[t.quadrant] || '#6b7280'}44;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700">
          ${t.quadrant || '?'}
        </span>
      </td>
      <td style="padding:10px 12px;color:#94a3b8;font-size:13px;font-family:monospace">${t.time || ''}</td>
    </tr>
  `).join('');

  const scheduleBlock = schedule ? `
    <div style="background:#131a2a;border:1px solid #1e2a40;border-radius:12px;padding:20px;margin:20px 0">
      <h3 style="margin:0 0 12px;color:#e2e8f0;font-size:15px">📅 Programa de Trabajo</h3>
      <pre style="margin:0;color:#94a3b8;font-size:13px;white-space:pre-wrap;line-height:1.6">${schedule}</pre>
    </div>` : '';

  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f1623;font-family:Inter,system-ui,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px">
      <div style="display:inline-flex;align-items:center;gap:10px;background:#161d2e;border:1px solid #1e2a40;border-radius:12px;padding:12px 20px">
        <span style="font-size:22px">⚡</span>
        <span style="font-weight:900;font-size:18px;color:#fff">Syncro-Daily</span>
      </div>
      <h1 style="color:#ffffff;font-size:24px;font-weight:800;margin:20px 0 4px">
        Buenos días${name ? ', ' + name : ''} 👋
      </h1>
      <p style="color:#64748b;font-size:14px;margin:0">${date} — Tu plan de batalla está listo</p>
    </div>

    <!-- Eisenhower Table -->
    <div style="background:#131a2a;border:1px solid #1e2a40;border-radius:12px;overflow:hidden;margin-bottom:20px">
      <div style="padding:12px 16px;border-bottom:1px solid #1e2a40;background:#161d2e">
        <h2 style="margin:0;color:#e2e8f0;font-size:14px;font-weight:700">📊 Matriz de Eisenhower</h2>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#161d2e">
            <th style="padding:8px 12px;text-align:left;color:#475569;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em">Tarea</th>
            <th style="padding:8px 12px;text-align:center;color:#475569;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em">Cuadrante</th>
            <th style="padding:8px 12px;text-align:left;color:#475569;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em">⏱ Est.</th>
          </tr>
        </thead>
        <tbody>${taskRows}</tbody>
      </table>
    </div>

    ${scheduleBlock}

    <!-- Footer -->
    <div style="text-align:center;padding-top:20px;border-top:1px solid #1e2a40">
      <a href="https://jorgeahmed.github.io/Pomodoro_RBR/app.html" style="display:inline-block;background:linear-gradient(135deg,#1152d4,#0d3fa8);color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:700;font-size:14px">
        Abrir Syncro-Daily →
      </a>
      <p style="color:#334155;font-size:11px;margin-top:16px">
        Recibiste este correo porque estás suscrito a Syncro-Daily.<br>
        <a href="https://jorgeahmed.github.io/Pomodoro_RBR" style="color:#3b82f6">Darte de baja</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}
