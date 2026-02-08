import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectionsChart } from "@/components/analysis/ProjectionsChart";
import { fetchProjectVisual } from "@/lib/api";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function Projections() {
  const location = useLocation();
  const jobId = (location.state as { jobId?: string } | null)?.jobId;
  const [points, setPoints] = useState<{ points: Awaited<ReturnType<typeof fetchProjectVisual>>["points"]; years: number[] } | null>(null);
  const [loading, setLoading] = useState(!!jobId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) {
      setLoading(false);
      return;
    }
    setError(null);
    fetchProjectVisual(jobId)
      .then((res) => {
        setPoints({ points: res.points, years: res.years });
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load projection data");
      })
      .finally(() => setLoading(false));
  }, [jobId]);

  if (!jobId) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>No job selected</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Open Future Projections from the Run Pipeline page after running the pipeline.
            </p>
            <Button asChild variant="default" className="gap-2">
              <Link to="/mvp">
                <ArrowLeft className="h-4 w-4" />
                Back to Run Pipeline
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-3 flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild className="gap-1">
          <Link to="/mvp">
            <ArrowLeft className="h-4 w-4" />
            Back to Run Pipeline
          </Link>
        </Button>
        <h1 className="text-lg font-semibold">Future Projections (2030 / 2040)</h1>
      </header>
      <main className="p-6 max-w-4xl mx-auto">
        {loading && (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading projection data…</span>
          </div>
        )}
        {error && (
          <Card className="border-destructive/50">
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">{error}</p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link to="/mvp">Back to Run Pipeline</Link>
              </Button>
            </CardContent>
          </Card>
        )}
        {!loading && !error && points && (
          <ProjectionsChart points={points.points} years={points.years} />
        )}
      </main>
    </div>
  );
}
