import LegalPage from "@/components/LegalPage";
import markdown from "@/content/terms-of-service.md?raw";

export default function Terms() {
    return <LegalPage title="Terms of Service" markdown={markdown} />;
}
