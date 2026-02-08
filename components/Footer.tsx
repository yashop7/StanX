import Link from 'next/link';
import { Clapperboard, Twitter, Github, MessageCircle } from 'lucide-react';

const socialLinks = [
  { icon: Twitter, href: 'https://x.com/yashtwt7', label: 'Twitter' },
  { icon: Github, href: 'https://github.com/yashop7', label: 'GitHub' },
  { icon: MessageCircle, href: '#', label: 'Discord' },
];

export const Footer = () => {
  return (
    <footer className="border-t border-border/20 bg-gradient-to-b from-muted/5 to-background">
      <div className="container mx-auto px-4 py-14 md:py-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-14">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg mb-4 hover-scale inline-flex">
              <Clapperboard className="h-5 w-5 text-primary" />
              <span>Finwe</span>
            </Link>
            <p className="text-sm text-muted-foreground mb-5 max-w-xs">
              The premier entertainment prediction market. Trade on the outcomes of your favorite creators and shows.
            </p>
            <div className="flex gap-2">
              {socialLinks.map((social, i) => (
                <a 
                  key={i} 
                  href={social.href} 
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="w-10 h-10 rounded-xl bg-muted/30 border border-border/30 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:border-border/50 transition-all duration-200"
                >
                  <social.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {[
            { title: 'Product', links: [{ href: '/markets', label: 'Markets', internal: true }, { href: '/create-market', label: 'Create Market', internal: true }, { href: '/portfolio', label: 'Portfolio', internal: true }] },
            { title: 'Resources', links: [{ href: '#', label: 'Documentation', internal: false }, { href: '#', label: 'How CLOB Works', internal: false }, { href: '#', label: 'Help Center', internal: false }] },
            { title: 'Company', links: [{ href: '#', label: 'About', internal: false }, { href: '#', label: 'Privacy Policy', internal: false }, { href: '#', label: 'Terms of Service', internal: false }] },
          ].map((section) => (
            <div key={section.title}>
              <h4 className="font-semibold mb-5 text-sm">{section.title}</h4>
              <ul className="space-y-3">
                {section.links.map((link) => (
                  <li key={link.label}>
                    {link.internal ? (
                      <Link href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors hover-scale inline-block">
                        {link.label}
                      </Link>
                    ) : (
                      <a href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors hover-scale inline-block">
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 border-t border-border/20 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">© 2024 Finwe. All rights reserved.</p>
          <div className="flex items-center gap-6">
            {['Privacy', 'Terms', 'Cookies'].map((item) => (
              <a key={item} href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors hover-scale">{item}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};
