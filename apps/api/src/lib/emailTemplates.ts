function wrapper(bodyHtml: string) {
  return `<div style="font-family: sans-serif; font-size: 14px; color: #1a1a1a; line-height: 1.5;">${bodyHtml}</div>`;
}

export function otpEmail(otp: string) {
  return {
    subject: "Your password reset code",
    html: wrapper(
      `<p>Your one-time password reset code is:</p>
       <p style="font-size: 24px; font-weight: 700; letter-spacing: 4px;">${otp}</p>
       <p>This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>`,
    ),
  };
}

export function welcomeEmail(firstName: string, email: string, password: string, loginUrl: string) {
  return {
    subject: "Your School Management System account",
    html: wrapper(
      `<p>Hi ${firstName},</p>
       <p>An account has been created for you. Here are your login details:</p>
       <ul>
         <li>Email: <strong>${email}</strong></li>
         <li>Temporary password: <strong>${password}</strong></li>
       </ul>
       <p>Log in at <a href="${loginUrl}">${loginUrl}</a> and change your password from your profile menu after signing in.</p>`,
    ),
  };
}

export function accountInviteEmail(firstName: string, otp: string, claimUrl: string) {
  return {
    subject: "Set up your School Management System account",
    html: wrapper(
      `<p>Hi ${firstName},</p>
       <p>Your school has set up a portal account for you. Use this code to set your own password:</p>
       <p style="font-size: 24px; font-weight: 700; letter-spacing: 4px;">${otp}</p>
       <p>This code expires in 10 minutes. Go to <a href="${claimUrl}">${claimUrl}</a> and enter it along with your email to choose your password.</p>`,
    ),
  };
}

export function passwordChangedEmail(reason: "admin_reset" | "otp_reset") {
  const explanation =
    reason === "admin_reset"
      ? "An administrator reset your password."
      : "Your password was reset using the forgot-password code sent to this email.";
  return {
    subject: "Your password was changed",
    html: wrapper(
      `<p>${explanation}</p>
       <p>If this wasn't you, contact your school administrator immediately.</p>`,
    ),
  };
}
