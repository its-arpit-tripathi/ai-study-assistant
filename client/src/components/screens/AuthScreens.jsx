import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '../common/GlassCard';
import Button from '../common/Button';
import Input from '../common/Input';
import { FiMail, FiLock, FiUser, FiArrowRight } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';

const AuthScreens = ({ onBack }) => {
  const [isLogin, setIsLogin] = useState(true);
  const { login, signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    let result;
    if (isLogin) {
      result = await login(email, password);
    } else {
      // The backend /signup only expects email and password
      result = await signup(email, password);
    }

    if (!result.success) {
      setError(result.error || 'Authentication failed. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-tertiary/20 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[420px] z-10"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-glass-fill border border-glass-border mb-6">
            <span className="text-2xl text-primary font-bold">L.</span>
          </div>
          <h1 className="text-3xl font-bold text-on-surface mb-2">
            {isLogin ? 'Welcome back' : 'Create an account'}
          </h1>
          <p className="text-text-muted">
            {isLogin ? 'Enter your details to access your study space.' : 'Start your enlightened learning journey today.'}
          </p>
        </div>

        <GlassCard>
          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="popLayout">
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <Input
                    icon={<FiUser />}
                    type="text"
                    placeholder="Full Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <Input
              icon={<FiMail />}
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            
            <Input
              icon={<FiLock />}
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {isLogin && (
              <div className="flex justify-end">
                <button type="button" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">
                  Forgot password?
                </button>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm text-center">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full mt-6" icon={!loading && <FiArrowRight className="ml-2" />}>
              {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-text-muted hover:text-on-surface transition-colors"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
          {onBack && (
            <div className="mt-4 text-center">
              <button
                onClick={onBack}
                className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                Return to Home
              </button>
            </div>
          )}
        </GlassCard>
      </motion.div>
    </div>
  );
};

export default AuthScreens;
