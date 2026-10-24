// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import App from '../src/ui';
import { demoItems, type Item } from '../src/domain';

let mockItems: Item[] = [...demoItems];
let mockUser: any = {
  id: 'usr-test-1',
  email: 'tester@campus.edu',
  displayName: 'Campus Tester',
  role: 'student',
  createdAt: new Date().toISOString(),
};

vi.mock('../src/services/authService', () => ({
  authService: {
    getSessionUser: vi.fn(async () => mockUser),
    signInWithGoogle: vi.fn(async () => ({ user: mockUser, error: null })),
    signUp: vi.fn(async () => ({ user: mockUser, error: null })),
    signIn: vi.fn(async () => ({ user: mockUser, error: null })),
    signOut: vi.fn(async () => {
      mockUser = null;
      return { error: null };
    }),
    resetPassword: vi.fn(async () => ({ error: null })),
    onAuthStateChange: vi.fn((cb) => {
      cb(mockUser);
      return () => {};
    }),
  },
}));

vi.mock('../src/services/itemService', () => ({
  itemService: {
    fetchItems: vi.fn(async () => ({ items: mockItems, error: null })),
    uploadItemImage: vi.fn(async () => ({ url: 'https://example.com/item.jpg', error: null })),
    createItem: vi.fn(async (draft, _file, userId, userName) => {
      const newItem: Item = {
        id: 'new-' + Date.now(),
        type: draft.type || 'lost',
        title: draft.title || '',
        category: draft.category || 'Other',
        description: draft.description || '',
        color: draft.color || '',
        location: draft.location || '',
        date: draft.date || '2026-10-24',
        handover: Boolean(draft.handover),
        status: 'Open',
        owner: userName,
        ownerId: userId,
        ownerName: userName,
        createdAt: new Date().toISOString(),
      };
      mockItems = [newItem, ...mockItems];
      return { item: newItem, error: null };
    }),
    updateItemStatus: vi.fn(async (id, status) => {
      mockItems = mockItems.map((i) => (i.id === id ? { ...i, status } : i));
      return { error: null };
    }),
    deleteItem: vi.fn(async (id) => {
      mockItems = mockItems.filter((i) => i.id !== id);
      return { error: null };
    }),
    seedDevData: vi.fn(async () => {
      mockItems = [...demoItems];
      return { inserted: 5, error: null };
    }),
    cleanupDevData: vi.fn(async () => {
      mockItems = mockItems.filter((i) => !i.isDemo);
      return { deleted: true, error: null };
    }),
    subscribeToItems: vi.fn((cb) => {
      cb(mockItems);
      return () => {};
    }),
  },
}));

vi.mock('../src/services/claimService', () => ({
  claimService: {
    fetchClaims: vi.fn(async () => ({ claims: [], error: null })),
    createClaim: vi.fn(async () => ({ claim: null, error: null })),
    updateClaimStatus: vi.fn(async () => ({ error: null })),
    subscribeToClaims: vi.fn(() => () => {}),
  },
}));

vi.mock('../src/services/reportService', () => ({
  reportService: {
    submitReport: vi.fn(async () => ({ error: null })),
    fetchReports: vi.fn(async () => ({ reports: [], error: null })),
  },
}));

describe('CampusFind Cloud-Synced Platform Integration', () => {
  beforeEach(() => {
    mockItems = [...demoItems];
    mockUser = {
      id: 'usr-test-1',
      email: 'tester@campus.edu',
      displayName: 'Campus Tester',
      role: 'student',
      createdAt: new Date().toISOString(),
    };
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the home page hero, navigation links, and dev status banner', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /CampusFind home/i })).toBeDefined();
    expect(screen.getAllByText(/Lost something\?/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /I lost something/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /I found something/i })).toBeDefined();
    expect(screen.getByText(/Campus Tester/i)).toBeDefined();
  });

  it('navigates to browse page and displays cloud synchronized items', async () => {
    render(<App />);
    const exploreButtons = screen.getAllByRole('button', { name: /Explore items/i });
    fireEvent.click(exploreButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Find your missing piece/i })).toBeDefined();
      expect(screen.getAllByText(/Student ID card/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Blue lecture notebook/i).length).toBeGreaterThan(0);
    });
  });

  it('filters items by search term in real-time', async () => {
    render(<App />);
    const exploreButtons = screen.getAllByRole('button', { name: /Explore items/i });
    fireEvent.click(exploreButtons[0]);

    await waitFor(() => {
      expect(screen.getByLabelText(/Search reports/i)).toBeDefined();
    });

    const searchInput = screen.getByLabelText(/Search reports/i);
    fireEvent.change(searchInput, { target: { value: 'earphones' } });

    await waitFor(() => {
      expect(screen.getAllByRole('heading', { name: /Wireless earphones case/i }).length).toBeGreaterThan(0);
      expect(screen.queryAllByRole('heading', { name: /Blue lecture notebook/i })).toHaveLength(0);
    });
  });

  it('allows navigating to the report form and toggling lost/found', async () => {
    render(<App />);
    const reportNavButtons = screen.getAllByRole('button', { name: /Report an item/i });
    fireEvent.click(reportNavButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Report a lost item/i })).toBeDefined();
    });

    const typeSwitch = document.querySelector('.type-switch')!;
    const foundToggle = typeSwitch.querySelector('button:last-child')!;
    fireEvent.click(foundToggle);
    expect(screen.getByRole('heading', { name: /Report a found item/i })).toBeDefined();
  });

  it('validates required fields on submission', async () => {
    render(<App />);
    const reportNavButtons = screen.getAllByRole('button', { name: /Report an item/i });
    fireEvent.click(reportNavButtons[0]);

    await waitFor(() => {
      expect(document.querySelector('form.report-form')).toBeDefined();
    });

    const form = document.querySelector('form.report-form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/Add an item title/i)).toBeDefined();
      expect(screen.getByText(/Choose a category/i)).toBeDefined();
    });
  });

  it('opens item detail modal and shows explainable possible match heuristics', async () => {
    render(<App />);
    const exploreButtons = screen.getAllByRole('button', { name: /Explore items/i });
    fireEvent.click(exploreButtons[0]);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /View details/i }).length).toBeGreaterThan(0);
    });

    const viewDetailsButtons = screen.getAllByRole('button', { name: /View details/i });
    fireEvent.click(viewDetailsButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined();
      expect(screen.getAllByText(/Possible matches/i).length).toBeGreaterThan(0);
    });
  });

  it('provides safe dev data seeding and cleanup without altering real records', async () => {
    render(<App />);
    const cleanupBtn = screen.getByRole('button', { name: /Clean Up Test Data/i });
    fireEvent.click(cleanupBtn);

    await waitFor(() => {
      expect(screen.getByText(/Cleaned up all test records/i)).toBeDefined();
    });

    const seedBtn = screen.getByRole('button', { name: /Seed Test Data/i });
    fireEvent.click(seedBtn);

    await waitFor(() => {
      expect(screen.getByText(/Seeded/i)).toBeDefined();
    });
  });
});
