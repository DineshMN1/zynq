import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';

// Controllable navigate mock
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/' }),
  };
});

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
  return (
    <MemoryRouter>
      <AuthProvider>{children}</AuthProvider>
    </MemoryRouter>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
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
    expect(result.current.needsSetup).toBeNull();
  });

  it('after mount, calls getSetupStatus and auth check', async () => {
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

  it('login() sets user', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const mockUser = {
      id: '2',
      name: 'New User',
      email: 'new@test.com',
      role: 'admin' as const,
    };

    act(() => {
      result.current.login(mockUser);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.needsSetup).toBe(false);
  });

  it('login() accepts user object without token', async () => {
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

    expect(result.current.user).toEqual(mockUser);
  });

  it('logout() clears user and redirects to /login', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('provides user data after successful auth check', async () => {
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
  });

  it('clears user when auth check fails', async () => {
    mockMe.mockRejectedValue(new Error('Unauthorized'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBeNull();
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
      expect(mockNavigate).toHaveBeenCalledWith('/setup', { replace: true });
    });
  });

  it('refreshUser() updates user from API', async () => {
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
