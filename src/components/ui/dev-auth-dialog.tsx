import React, { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent } from "./dialog";
import { User, Loader2, LogIn, Eye, EyeOff, Terminal } from "lucide-react";

interface DevAuthDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSignIn: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  onSignUp: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
}

export const DevAuthDialog: React.FC<DevAuthDialogProps> = ({
  isOpen,
  onOpenChange,
  onSignIn,
  onSignUp,
}) => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const dialogRef = useRef<HTMLDivElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && emailInputRef.current) {
      // Focus email input when dialog opens
      setTimeout(() => {
        emailInputRef.current?.focus();
      }, 100);
    }
    if (!isOpen) {
      // Reset form when dialog closes
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setError("");
      setMode("login");
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      setError("Email and password are required");
      return;
    }

    if (mode === "signup") {
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters");
        return;
      }
    }

    setLoading(true);
    setError("");

    try {
      const result =
        mode === "login"
          ? await onSignIn(email.trim(), password)
          : await onSignUp(email.trim(), password);

      if (result.success) {
        onOpenChange(false);
      } else {
        setError(
          result.error || `${mode === "login" ? "Login" : "Signup"} failed`
        );
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePasswordVisibility = (field: "password" | "confirm") => {
    if (field === "password") {
      setShowPassword(!showPassword);
    } else {
      setShowConfirmPassword(!showConfirmPassword);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        ref={dialogRef}
        className="w-[520px] max-w-lg border-0 rounded-3xl p-0 overflow-hidden shadow-2xl backdrop-blur-lg"
        style={{ backgroundColor: "#1a1a1a" }}
      >
        {/* Header with Logo and Title */}
        <div className="flex flex-col items-center justify-center p-8 bg-gradient-to-b from-white/10 to-transparent">
          <div className="flex items-center gap-4 mb-4">
            <Terminal className="w-8 h-8 text-green-400" />
            <h1 className="text-2xl font-bold text-green-400">
              Developer Auth
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <LogIn className="w-5 h-5 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-300">
              {mode === "login"
                ? "Local Development Login"
                : "Create Developer Account"}
            </h3>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Secret Command+Z Developer Access • Local Development Only
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-6">
          {error && (
            <div className="p-4 bg-red-900/30 border border-red-500/50 rounded-xl">
              <p className="text-red-300 text-sm text-center">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {/* Email Input */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <input
                ref={emailInputRef}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@example.com"
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all"
                disabled={loading}
                required
              />
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-3 pr-12 bg-gray-800/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all"
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  onClick={() => handleTogglePasswordVisibility("password")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password Input (only for signup) */}
            {mode === "signup" && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    className="w-full px-4 py-3 pr-12 bg-gray-800/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all"
                    disabled={loading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => handleTogglePasswordVisibility("confirm")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                    disabled={loading}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-4 text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed text-black bg-green-400 hover:bg-green-300 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 shadow-sm hover:shadow-md"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <User className="w-5 h-5" />
                {mode === "login" ? "Login" : "Create Account"}
              </>
            )}
          </button>

          {/* Mode Toggle */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError("");
                setPassword("");
                setConfirmPassword("");
              }}
              disabled={loading}
              className="text-green-400 hover:text-green-300 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {mode === "login"
                ? "Need an account? Sign up"
                : "Already have an account? Login"}
            </button>
          </div>

          {/* Close hint */}
          <div className="text-center">
            <p className="text-xs text-gray-500">
              Press Escape or click outside to close • Command+Z to reopen
            </p>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
