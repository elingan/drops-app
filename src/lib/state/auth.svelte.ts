import { authClient } from '$lib/auth-client';
import type { User } from '$lib/domain/types';

type AuthStatus = 'unknown' | 'authenticated' | 'anonymous';

class AuthState {
	user = $state<User | null>(null);
	status = $state<AuthStatus>('unknown');
	private checking: Promise<void> | null = null;

	/** Resolves the current session once (cached); offline keeps the last known user. */
	check(force = false): Promise<void> {
		if (this.checking && !force) return this.checking;
		this.checking = (async () => {
			try {
				const { data, error } = await authClient.getSession();
				if (error) throw error;
				this.setUser(data?.user ?? null);
			} catch {
				const cached = readCachedUser();
				// Offline with a previous session: let the user keep studying locally.
				if (cached && typeof navigator !== 'undefined' && !navigator.onLine) this.setUser(cached);
				else this.setUser(null);
			}
		})();
		return this.checking;
	}

	async signIn(email: string, password: string): Promise<'ok' | 'invalid' | 'network'> {
		try {
			const { data, error } = await authClient.signIn.email({ email, password });
			if (error || !data) return error?.status && error.status >= 500 ? 'network' : 'invalid';
			this.setUser(data.user);
			return 'ok';
		} catch {
			return 'network';
		}
	}

	async signOut(): Promise<void> {
		try {
			await authClient.signOut();
		} finally {
			this.setUser(null);
		}
	}

	private setUser(u: { id: string; name: string; email: string } | null) {
		this.user = u ? { id: u.id, name: u.name, email: u.email } : null;
		this.status = u ? 'authenticated' : 'anonymous';
		try {
			if (u) localStorage.setItem('d10:user', JSON.stringify(this.user));
			else localStorage.removeItem('d10:user');
		} catch {
			/* storage unavailable */
		}
	}
}

function readCachedUser(): User | null {
	try {
		const raw = localStorage.getItem('d10:user');
		return raw ? (JSON.parse(raw) as User) : null;
	} catch {
		return null;
	}
}

export const auth = new AuthState();
