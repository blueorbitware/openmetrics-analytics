"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BarChart3, Mail, ArrowLeft, ShieldAlert } from "lucide-react";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-cyan-500 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        </div>
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <BarChart3 className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Analytics</h1>
              <p className="text-blue-200 text-sm">Dashboard Platform</p>
            </div>
          </div>
          
          <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6">
            Account<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
              Recovery
            </span>
          </h2>
          
          <p className="text-lg text-blue-100/80 max-w-md">
            Need help accessing your account? Contact your system administrator for assistance.
          </p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-12 xl:px-20 bg-slate-50 dark:bg-slate-900">
        <div className="mx-auto w-full max-w-md text-center">
          {/* Mobile Logo */}
          <div className="flex items-center justify-center gap-3 mb-8 lg:hidden">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Analytics</h1>
              <p className="text-muted-foreground text-sm">Dashboard</p>
            </div>
          </div>

          <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-500/25">
            <ShieldAlert className="w-10 h-10 text-white" />
          </div>

          <h2 className="text-3xl font-bold mb-4">Forgot Password?</h2>
          <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
            Password reset is managed by your system administrator. Please contact them to reset your password.
          </p>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Mail className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium">Contact Administrator</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Your administrator can reset your password and provide you with new login credentials.
            </p>
          </div>

          <Link href="/login">
            <Button 
              className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-medium shadow-lg shadow-blue-500/25 transition-all duration-300"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Login
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
