'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Cloud, Shield, Zap, Lock, Users, HardDrive } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cloud className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold">zynqCloud</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href="/login">Login</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 md:py-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-4xl mx-auto"
        >
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
            Self-Hosted File Management
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Take control of your data with zynqCloud. Secure, fast, and completely self-hosted file storage for teams and individuals.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-lg px-8" asChild>
              <Link href="/register">Start Free Trial</Link>
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
          Everything you need to manage files
        </h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {[
            {
              icon: Shield,
              title: 'Secure & Private',
              description: 'Your data stays on your infrastructure. Complete control and privacy.',
            },
            {
              icon: Zap,
              title: 'Lightning Fast',
              description: 'Built for speed with efficient metadata storage and S3 integration.',
            },
            {
              icon: Lock,
              title: 'Role-Based Access',
              description: 'Fine-grained permissions and invite-only registration.',
            },
            {
              icon: Users,
              title: 'Team Collaboration',
              description: 'Share files securely with read/write permissions for your team.',
            },
            {
              icon: HardDrive,
              title: 'Flexible Storage',
              description: 'Connect to S3, MinIO, or any S3-compatible storage backend.',
            },
            {
              icon: Cloud,
              title: 'Self-Hosted',
              description: 'Deploy on your own servers. No vendor lock-in, no monthly fees.',
            },
          ].map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="p-6 rounded-2xl bg-card border border-border hover:border-primary/50 transition-colors"
            >
              <feature.icon className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto text-center p-12 rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to take control of your files?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join teams already using zynqCloud for secure, self-hosted file management.
          </p>
          <Button size="lg" className="text-lg px-8" asChild>
            <Link href="/register">Get Started Now</Link>
          </Button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 mt-20">
        <div className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
          <p>© 2024 zynqCloud. Self-hosted file management platform.</p>
        </div>
      </footer>
    </div>
  );
}