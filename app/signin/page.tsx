'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SignIn() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);


    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900">
            <form  className="w-full max-w-md p-8 bg-gray-800 rounded-lg">
                <h1 className="text-2xl font-bold text-white mb-6">Sign In</h1>
                
                {error && <p className="text-red-500 mb-4">{error}</p>}
                
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2 mb-4 bg-gray-700 text-white rounded"
                    required
                />
                
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2 mb-6 bg-gray-700 text-white rounded"
                    required
                />
                
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                    {loading ? 'Signing in...' : 'Sign In'}
                </button>
            </form>
        </div>
    );
}