import type { Metadata } from "next";
import { NewPasswordForm } from "./NewPasswordForm";

export const metadata: Metadata = { title: "Nova senha" };

export default function Page() {
  return <NewPasswordForm />;
}
