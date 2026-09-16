import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import SecondaryShell, { AccessErrorState, PageSkeleton } from "@/components/secondary/SecondaryShell";
import { fetchStartHere } from "@/lib/secondaryApi";

/** Lands a student on their next lesson in the free chapter (Ch00). Backs the
 * onboarding paywall's "start the free chapter" path. */
export default function SecondaryStart() {
    return <SecondaryShell>{({ accessToken }) => <Redirector accessToken={accessToken} />}</SecondaryShell>;
}

function Redirector({ accessToken }: { accessToken: string }) {
    const [, navigate] = useLocation();
    const [error, setError] = useState<unknown>(null);

    const go = () => {
        setError(null);
        fetchStartHere(accessToken)
            .then((res) => navigate(res.subsection_id ? `/secondary/subsections/${res.subsection_id}` : "/secondary/learn", { replace: true }))
            .catch(setError);
    };

    useEffect(() => {
        go();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accessToken]);

    return error ? <AccessErrorState error={error} onRetry={go} /> : <PageSkeleton />;
}
