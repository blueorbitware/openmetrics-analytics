import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BarChart3 } from "lucide-react";

export default function PrivacyPolicyPage() {
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
          <h1 className="text-3xl font-bold">Privacy Policy</h1>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Information We Collect</h2>
            <p className="text-muted-foreground">
              We collect information you provide directly (account information, contact details) 
              and information collected automatically (usage data, device information, cookies).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. How We Use Your Information</h2>
            <p className="text-muted-foreground">
              We use your information to provide and improve our services, communicate with you, 
              ensure security, and comply with legal obligations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Data Retention</h2>
            <p className="text-muted-foreground">
              We retain your data for as long as your account is active or as needed to provide 
              services. You can configure data retention periods in your workspace settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Data Security</h2>
            <p className="text-muted-foreground">
              We implement industry-standard security measures including encryption, access controls, 
              and regular security audits to protect your data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Your Rights (GDPR)</h2>
            <p className="text-muted-foreground">
              You have the right to access, correct, delete, or export your data. You can also 
              object to processing or request restriction. Contact us or use the Privacy section 
              in your dashboard to exercise these rights.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Cookies</h2>
            <p className="text-muted-foreground">
              We use cookies and similar technologies to provide functionality, analyze usage, 
              and personalize your experience. You can manage cookie preferences in your browser.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Third-Party Services</h2>
            <p className="text-muted-foreground">
              We may use third-party services for hosting, analytics, and other purposes. 
              These services have their own privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Contact Us</h2>
            <p className="text-muted-foreground">
              For privacy-related questions or to exercise your rights, please contact us at 
              privacy@analytics-dashboard.com
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
