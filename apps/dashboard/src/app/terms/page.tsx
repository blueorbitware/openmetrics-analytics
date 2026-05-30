import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BarChart3 } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Link href="/login">
          <Button variant="ghost" className="mb-8">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold">Terms of Service</h1>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground">
              By accessing and using Analytics Dashboard, you agree to be bound by these Terms of Service. 
              If you do not agree to these terms, please do not use our services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Description of Service</h2>
            <p className="text-muted-foreground">
              Analytics Dashboard provides web and mobile analytics services including event tracking, 
              user behavior analysis, session replay, heatmaps, and AI-powered insights.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. User Responsibilities</h2>
            <p className="text-muted-foreground">
              You are responsible for maintaining the confidentiality of your account credentials and 
              for all activities that occur under your account. You agree to notify us immediately 
              of any unauthorized use of your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Data Collection</h2>
            <p className="text-muted-foreground">
              Our platform collects analytics data from your websites and applications. You are 
              responsible for ensuring you have proper consent from your users for data collection 
              as required by applicable laws.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Privacy</h2>
            <p className="text-muted-foreground">
              Your privacy is important to us. Please review our Privacy Policy to understand how 
              we collect, use, and protect your information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Limitation of Liability</h2>
            <p className="text-muted-foreground">
              Analytics Dashboard is provided "as is" without warranties of any kind. We shall not 
              be liable for any indirect, incidental, or consequential damages arising from your 
              use of the service.
            </p>
          </section>

          <p className="text-sm text-muted-foreground pt-6 border-t">
            Last updated: January 2024
          </p>
        </div>
      </div>
    </div>
  );
}
