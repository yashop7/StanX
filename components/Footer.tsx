import { Link } from 'react-router-dom';
import { TrendingUp, Twitter, Github, MessageCircle } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="border-t border-border/20 bg-gradient-to-b from-muted/5 to-background">
      <div className="container mx-auto px-4 py-14 md:py-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-14">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 font-bold text-lg mb-4 hover-scale inline-flex">
              <TrendingUp className="h-5 w-5" />
              <span>PredictX</span>
            </Link>
            <p className="text-sm text-muted-foreground mb-5 max-w-xs">
              The premier prediction market platform. Trade on the outcomes of real-world events.
            </p>
            <div className="flex gap-2">
              {[Twitter, Github, MessageCircle].map((Icon, i) => (
                <a key={i} href="#" className="w-10 h-10 rounded-xl glass-card flex items-center justify-center text-muted-foreground hover:text-foreground hover-scale transition-colors">
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {[
            { title: 'Product', links: [{ to: '/markets', label: 'Markets' }, { to: '/create-market', label: 'Create Market' }, { to: '/portfolio', label: 'Portfolio' }] },
            { title: 'Resources', links: [{ href: '#', label: 'Documentation' }, { href: '#', label: 'API Reference' }, { href: '#', label: 'Help Center' }] },
            { title: 'Company', links: [{ href: '#', label: 'About' }, { href: '#', label: 'Privacy Policy' }, { href: '#', label: 'Terms of Service' }] },
          ].map((section) => (
            <div key={section.title}>
              <h4 className="font-semibold mb-5 text-sm">{section.title}</h4>
              <ul className="space-y-3">
                {section.links.map((link) => (
                  <li key={link.label}>
                    {'to' in link ? (
                      <Link to={link.to} className="text-sm text-muted-foreground hover:text-foreground transition-colors hover-scale inline-block">
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
          <p className="text-xs text-muted-foreground">© 2024 PredictX. All rights reserved.</p>
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
