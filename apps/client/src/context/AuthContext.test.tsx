import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { AuthProvider, useAuth } from './AuthContext';

// Mock next/navigation with controllable fns
const mockPush = vi.fn();
const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
}));

// Mock the api module
const mockGetSetupStatus = vi.fn();
const mockMe = vi.fn();
vi.mock('@/lib/api', () => ({
  authApi: {
    getSetupStatus: (...args: unknown[]) => mockGetSetupStatus(...args),
    me: (...args: unknown[]) => mockMe(...args),
  },
}));

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
    // Default: setup not needed, no token
    mockGetSetupStatus.mockResolvedValue({ needsSetup: false });
    mockMe.mockResolvedValue({
      id: '1',
      name: 'Test',
      email: 'test@test.com',
      role: 'user',
    });
  });

  it('initial state has loading=true', () => {
    // Prevent setup from resolving immediately
    mockGetSetupStatus.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.needsSetup).toBeNull();
  });

  it('after mount, calls getSetupStatus and auth check when token exists', async () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
      'saved-token',
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetSetupStatus).toHaveBeenCalledTimes(1);
    expect(mockMe).toHaveBeenCalledTimes(1);
    expect(result.current.user).toEqual({
      id: '1',
      name: 'Test',
      email: 'test@test.com',
      role: 'user',
    });
  });

  it('does not call authApi.me when no token is saved', async () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetSetupStatus).toHaveBeenCalledTimes(1);
    expect(mockMe).not.toHaveBeenCalled();
    expect(result.current.user).toBeNull();
  });

  it('login() stores token and sets user', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const mockUser = {
      id: '2',
      name: 'New User',
      email: 'new@test.com',
      role: 'admin' as const,
      token: 'new-token-123',
    };

    act(() => {
      result.current.login(mockUser);
    });

    expect(localStorage.setItem).toHaveBeenCalledWith('token', 'new-token-123');
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.token).toBe('new-token-123');
    expect(result.current.needsSetup).toBe(false);
  });

  it('login() does nothing when user has no token', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const mockUser = {
      id: '2',
      name: 'New User',
      email: 'new@test.com',
      role: 'user' as const,
      // no token field
    };

    act(() => {
      result.current.login(mockUser);
    });

    expect(localStorage.setItem).not.toHaveBeenCalled();
    expect(result.current.user).toBeNull();
  });

  it('logout() clears token and redirects to /login', async () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
      'saved-token',
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.logout();
    });

    expect(localStorage.removeItem).toHaveBeenCalledWith('token');
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('provides user data after successful auth check', async () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
      'valid-token',
    );
    mockMe.mockResolvedValue({
      id: '42',
      name: 'Jane Doe',
      email: 'jane@example.com',
      role: 'owner',
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toEqual({
      id: '42',
      name: 'Jane Doe',
      email: 'jane@example.com',
      role: 'owner',
    });
    expect(result.current.token).toBe('valid-token');
  });

  it('clears token when auth check fails', async () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
      'invalid-token',
    );
    mockMe.mockRejectedValue(new Error('Unauthorized'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(localStorage.removeItem).toHaveBeenCalledWith('token');
  });

  it('sets needsSetup=true and stops loading when setup is needed', async () => {
    mockGetSetupStatus.mockResolvedValue({ needsSetup: true });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.needsSetup).toBe(true);
    // Should not attempt to check auth when setup is needed
    expect(mockMe).not.toHaveBeenCalled();
  });

  it('redirects to /setup when needsSetup is true', async () => {
    mockGetSetupStatus.mockResolvedValue({ needsSetup: true });

    renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/setup');
    });
  });

  it('refreshUser() updates user from API', async () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
      'valid-token',
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Now change what me() returns and call refreshUser
    mockMe.mockResolvedValue({
      id: '1',
      name: 'Updated Name',
      email: 'test@test.com',
      role: 'admin',
    });

    await act(async () => {
      await result.current.refreshUser();
    });

    expect(result.current.user).toEqual({
      id: '1',
      name: 'Updated Name',
      email: 'test@test.com',
      role: 'admin',
    });
  });
});
