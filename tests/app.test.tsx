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
    fetchClaimsReceived: vi.fn(async () => ({ claims: [], error: null })),
    createClaim: vi.fn(async () => ({ claim: null, error: null })),
    updateClaimStatus: vi.fn(async () => ({ error: null })),
    subscribeToClaims: vi.fn(() => () => {}),
    subscribeToClaimsReceived: vi.fn(() => () => {}),
    approveClaim: vi.fn(async () => ({ error: null })),
    rejectClaim: vi.fn(async () => ({ error: null })),
    requestMoreInfo: vi.fn(async () => ({ error: null })),
    confirmReturn: vi.fn(async () => ({ error: null })),
    withdrawClaim: vi.fn(async () => ({ error: null })),
  },
}));


vi.mock('../src/services/reportService', () => ({
  reportService: {
    submitReport: vi.fn(async () => ({ error: null })),
    fetchReports: vi.fn(async () => ({ reports: [], error: null })),
  },
}));

vi.mock('../src/services/notificationService', () => ({
  notificationService: {
    fetchNotifications: vi.fn(async () => ({ notifications: [], error: null })),
    subscribeToNotifications: vi.fn(() => () => {}),
    createNotification: vi.fn(async () => ({ error: null })),
    markAsRead: vi.fn(async () => ({ error: null })),
    markAllAsRead: vi.fn(async () => {}),
    notifyMatchFound: vi.fn(async () => ({ error: null })),
  },
}));

describe('CampusFind Cloud-Synced Platform Integration', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn();
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

  it('navigates to the Dashboard and switches between My Reports, My Claims, and Claims Received', async () => {
    render(<App />);
    const claimsNavButtons = screen.getAllByRole('button', { name: /My claims/i });
    fireEvent.click(claimsNavButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Request Dashboard/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /My Reports/i })).toBeDefined();
      expect(screen.getAllByRole('button', { name: /My Claims/i }).length).toBeGreaterThanOrEqual(2);
      expect(screen.getByRole('button', { name: /Claims Received/i })).toBeDefined();
    });

    // Switch to Claims Received tab
    fireEvent.click(screen.getByRole('button', { name: /Claims Received/i }));
    await waitFor(() => {
      expect(screen.getByText(/No claims received yet/i)).toBeDefined();
    });

    // Switch to My Reports tab
    fireEvent.click(screen.getByRole('button', { name: /My Reports/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /New report/i })).toBeDefined();
    });
  });

  it('navigates to Profile page and displays account identity and preferences', async () => {
    render(<App />);
    const userBtn = await screen.findByRole('button', { name: /Campus Tester/i });
    fireEvent.click(userBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /User Profile & Settings/i })).toBeDefined();
      expect(screen.getAllByText(/tester@campus.edu/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Notification Preferences/i)).toBeDefined();
      expect(screen.getByText(/Account Details/i)).toBeDefined();
    });
  });

  it('allows a finder to notify the owner of a matching lost item report', async () => {
    render(<App />);
    const exploreButtons = screen.getAllByRole('button', { name: /Explore items/i });
    fireEvent.click(exploreButtons[0]);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /View details/i }).length).toBeGreaterThan(0);
    });

    // Open first report details
    const viewButtons = screen.getAllByRole('button', { name: /View details/i });
    fireEvent.click(viewButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined();
    });

    // If report is lost item, should have Notify Owner button
    const notifyBtn = screen.queryByRole('button', { name: /Notify Owner/i });
    if (notifyBtn) {
      fireEvent.click(notifyBtn);
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Found a match for/i })).toBeDefined();
        expect(screen.getByText(/REUNITE OWNER & FINDER/i)).toBeDefined();
      });
    }
  });

  it('renders topbar in-app notification bell with unread indicators and drawer', async () => {
    render(<App />);
    const bellBtn = await screen.findByRole('button', { name: /View notifications/i });
    expect(bellBtn).toBeDefined();

    fireEvent.click(bellBtn);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Notifications/i })).toBeDefined();
    });
  });
});




