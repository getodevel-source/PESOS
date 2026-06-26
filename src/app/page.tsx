import Dashboard from "@/components/Dashboard";
import SetupWizard from "@/components/SetupWizard";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Show SetupWizard if no AI key is configured at all
  const hasGemini = !!process.env.GOOGLE_AI_API_KEY;
  const hasOpenCode = !!process.env.OPENCODE_GO_API_KEY;

  if (!hasGemini && !hasOpenCode) {
    return <SetupWizard />;
  }

  return <Dashboard initialUser={{ id: 'local', email: 'local@pesos' }} />;
}
