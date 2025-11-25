import { redirect } from "next/navigation";

export default function RootPage() {
  // Die Middleware schützt bereits alle Routen außer /sign-in, /sign-up, /api/webhooks
  // Wenn wir hier ankommen, ist der User authentifiziert
  redirect("/dashboard");
}
