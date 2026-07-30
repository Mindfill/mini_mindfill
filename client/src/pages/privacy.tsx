import LegalPage from "@/components/LegalPage";
import markdown from "@/content/privacy-policy.md?raw";

export default function Privacy() {
    return <LegalPage title="Privacy Policy" markdown={markdown} />;
}
