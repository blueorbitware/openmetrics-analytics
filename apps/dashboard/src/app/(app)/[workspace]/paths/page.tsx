"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GitBranch, Play } from "lucide-react";

export default function PathsPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Paths</h1>
          <p className="text-muted-foreground mt-1">
            Visualize user navigation flows
          </p>
        </div>
        <Button>
          <Play className="w-4 h-4 mr-2" />
          Run Analysis
        </Button>
      </div>

      <Card>
        <CardContent className="py-12 text-center">
          <GitBranch className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Path Analysis</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Discover how users navigate through your site.
            See the most common paths, entry points, and drop-off points.
          </p>
          <Button className="mt-6">
            <Play className="w-4 h-4 mr-2" />
            Analyze Paths
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
