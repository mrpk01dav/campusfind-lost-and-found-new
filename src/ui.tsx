import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  Search,
  Plus,
  ShieldCheck,
  MapPin,
  CalendarDays,
  ArrowRight,
  HeartHandshake,
  PackageSearch,
  CheckCircle2,
  AlertTriangle,
  X,
  Menu,
  RotateCcw,
  BookOpen,
  KeyRound,
  Smartphone,
  Filter,
  User,
  LogOut,
  Upload,
  Flag,
  Database,
  Cloud,
  Loader2,
  Phone,
  Camera,
  Edit3,
  Trash2,
  Check,
  Clock,
  Inbox,
  Send,
  Eye,
  Settings,
  Bell,
  Award,
  Medal,
  Printer,
  Sparkles,
  Lock,
  FileCheck,
} from 'lucide-react';
import {
  categories,
  findMatches,
  getTodayDateString,
  searchItems,
  dedupeById,
  validItemInput,
  validClaimInput,
  validAuthInput,
  validReportInput,
  validProfileInput,
  canEditReport,
  canCancelReport,
  canWithdrawClaim,
  calculateUserRewards,
  type Item,
  type ItemType,
  type Claim,
  type ClaimStatus,
  type UserProfile,
  type UserNotificationPreferences,
  type AppNotification,
  type NotificationType,
  type RewardTransaction,
  type AchievementBadge,
} from './domain';
import { isFirebaseConfigured } from './lib/firebase';
import { authService } from './services/authService';
import { itemService } from './services/itemService';
import { claimService } from './services/claimService';
import { reportService } from './services/reportService';
import { storageService } from './services/storageService';
import { notificationService } from './services/notificationService';
import { rewardService } from './services/rewardService';


const icons: Record<string, typeof PackageSearch> = {
  Electronics: Smartphone,
  'ID & Cards': ShieldCheck,
  'Books & Notes': BookOpen,
  Keys: KeyRound,
  Bags: PackageSearch,
};

export default function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('home');
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [formType, setFormType] = useState<ItemType>('lost');
  const [selected, setSelected] = useState<Item | null>(null);
  const [notice, setNotice] = useState('');
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);

  // Dashboard and Requests State
  const [dashboardTab, setDashboardTab] = useState<'my-reports' | 'lost-reports' | 'found-reports' | 'my-claims' | 'claims-received' | 'rewards'>('my-reports');
  const [claimsReceived, setClaimsReceived] = useState<Claim[]>([]);
  const [rewards, setRewards] = useState<RewardTransaction[]>([]);

  // Edit Report Modal State (with audit safeguards)
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editError, setEditError] = useState('');

  // Milestone Certificate Modal State
  const [selectedCertificateBadge, setSelectedCertificateBadge] = useState<AchievementBadge | null>(null);

  // Auth Modal State
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');
  const [tokenNoticeUrl, setTokenNoticeUrl] = useState<string | null>(null);

  // Claim Modal State
  const [claimTarget, setClaimTarget] = useState<Item | null>(null);
  const [claimDetails, setClaimDetails] = useState('');
  const [claimPhone, setClaimPhone] = useState('');
  const [claimEvidenceFile, setClaimEvidenceFile] = useState<File | null>(null);
  const [claimEvidencePreview, setClaimEvidencePreview] = useState<string | null>(null);

  // Reviewer Decision Modal State (For finder requesting more info or rejecting with reason)
  const [reviewActionClaim, setReviewActionClaim] = useState<Claim | null>(null);
  const [reviewActionType, setReviewActionType] = useState<'more_info' | 'reject' | null>(null);
  const [reviewActionNote, setReviewActionNote] = useState('');

  // Flag / Abuse Report Modal State
  const [flagTarget, setFlagTarget] = useState<Item | null>(null);
  const [flagReason, setFlagReason] = useState('Contains personal/sensitive info');
  const [flagDetails, setFlagDetails] = useState('');

  // Form image upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Notifications State
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Finder-to-Loser Match Notification Modal State
  const [notifyLoserItem, setNotifyLoserItem] = useState<Item | null>(null);
  const [notifyFoundItemId, setNotifyFoundItemId] = useState<string>('');
  const [notifyCustomNote, setNotifyCustomNote] = useState<string>('');

  // Profile Page State
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileDepartment, setProfileDepartment] = useState('');
  const [profileContactMethod, setProfileContactMethod] = useState<'email' | 'phone' | 'in_person'>('email');
  const [profileRewardsOptIn, setProfileRewardsOptIn] = useState(true);
  const [profilePrefs, setProfilePrefs] = useState<UserNotificationPreferences>({
    emailMatches: true,
    claimUpdates: true,
    newClaimsReceived: true,
  });
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Keep profile inputs in sync when user data loads/changes
  useEffect(() => {
    if (user) {
      setProfileName(user.displayName || '');
      setProfilePhone(user.phoneNumber || '');
      setProfileDepartment(user.department || '');
      setProfileContactMethod(user.preferredContactMethod || 'email');
      setProfileRewardsOptIn(user.rewardsOptIn ?? true);
      setProfilePrefs({
        emailMatches: user.notificationPreferences?.emailMatches ?? true,
        claimUpdates: user.notificationPreferences?.claimUpdates ?? true,
        newClaimsReceived: user.notificationPreferences?.newClaimsReceived ?? true,
      });
    }
  }, [user]);

  // 1. Initial Data and Auth Loading
  useEffect(() => {
    let isMounted = true;
    let unsubUserClaims: (() => void) | null = null;
    let unsubClaimsReceived: (() => void) | null = null;
    let unsubNotifications: (() => void) | null = null;
    let unsubRewards: (() => void) | null = null;

    async function init() {
      setLoading(true);
      const currentUser = await authService.getSessionUser();
      if (isMounted) setUser(currentUser);

      const itemsRes = await itemService.fetchItems();
      if (isMounted) {
        setItems(dedupeById(itemsRes.items));
        setLoading(false);
      }

      if (currentUser && isMounted) {
        const claimsRes = await claimService.fetchClaims(currentUser.id);
        if (isMounted) setClaims(dedupeById(claimsRes.claims));
        const receivedRes = await claimService.fetchClaimsReceived(currentUser.id);
        if (isMounted) setClaimsReceived(dedupeById(receivedRes.claims));
        const notifsRes = await notificationService.fetchNotifications(currentUser.id);
        if (isMounted) setNotifications(dedupeById(notifsRes.notifications));
        const rewardsRes = await rewardService.fetchRewards(currentUser.id);
        if (isMounted) setRewards(dedupeById(rewardsRes.rewards));

        // Attach realtime subscriptions
        unsubUserClaims = claimService.subscribeToClaims(currentUser.id, (userClaims) => {
          if (isMounted) setClaims(dedupeById(userClaims));
        });
        unsubClaimsReceived = claimService.subscribeToClaimsReceived(currentUser.id, (received) => {
          if (isMounted) setClaimsReceived(dedupeById(received));
        });
        unsubNotifications = notificationService.subscribeToNotifications(currentUser.id, (notes) => {
          if (isMounted) setNotifications(dedupeById(notes));
        });
        unsubRewards = rewardService.subscribeToRewards(currentUser.id, (userRewards) => {
          if (isMounted) setRewards(dedupeById(userRewards));
        });
      }
    }

    init();

    // Listen to real-time auth changes
    const unsubAuth = authService.onAuthStateChange(async (updatedUser, tokenNotice) => {
      if (isMounted) {
        if (tokenNotice) {
          setTokenNoticeUrl(tokenNotice);
        }
        setUser(updatedUser);
        if (unsubUserClaims) unsubUserClaims();
        if (unsubClaimsReceived) unsubClaimsReceived();
        if (unsubNotifications) unsubNotifications();
        if (unsubRewards) unsubRewards();

        if (updatedUser) {
          const claimsRes = await claimService.fetchClaims(updatedUser.id);
          if (isMounted) setClaims(dedupeById(claimsRes.claims));
          const receivedRes = await claimService.fetchClaimsReceived(updatedUser.id);
          if (isMounted) setClaimsReceived(dedupeById(receivedRes.claims));
          const notifsRes = await notificationService.fetchNotifications(updatedUser.id);
          if (isMounted) setNotifications(dedupeById(notifsRes.notifications));
          const rewardsRes = await rewardService.fetchRewards(updatedUser.id);
          if (isMounted) setRewards(dedupeById(rewardsRes.rewards));

          unsubUserClaims = claimService.subscribeToClaims(updatedUser.id, (userClaims) => {
            if (isMounted) setClaims(dedupeById(userClaims));
          });
          unsubClaimsReceived = claimService.subscribeToClaimsReceived(updatedUser.id, (received) => {
            if (isMounted) setClaimsReceived(dedupeById(received));
          });
          unsubNotifications = notificationService.subscribeToNotifications(updatedUser.id, (notes) => {
            if (isMounted) setNotifications(dedupeById(notes));
          });
          unsubRewards = rewardService.subscribeToRewards(updatedUser.id, (userRewards) => {
            if (isMounted) setRewards(dedupeById(userRewards));
          });
        } else {
          setClaims([]);
          setClaimsReceived([]);
          setNotifications([]);
          setRewards([]);
        }
      }
    });

    // Real-time cross-device synchronization for items
    const unsubItems = itemService.subscribeToItems((liveItems) => {
      if (isMounted) {
        setItems(dedupeById(liveItems));
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubAuth();
      unsubItems();
      if (unsubUserClaims) unsubUserClaims();
      if (unsubClaimsReceived) unsubClaimsReceived();
      if (unsubNotifications) unsubNotifications();
      if (unsubRewards) unsubRewards();
    };
  }, []);


  // 2. Escape Key to Dismiss Modals
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (authOpen) setAuthOpen(false);
        else if (editingItem) setEditingItem(null);
        else if (selectedCertificateBadge) setSelectedCertificateBadge(null);
        else if (flagTarget) setFlagTarget(null);
        else if (claimTarget) setClaimTarget(null);
        else if (selected) setSelected(null);
        else if (notifyLoserItem) setNotifyLoserItem(null);
        else if (notificationsOpen) setNotificationsOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [authOpen, editingItem, selectedCertificateBadge, flagTarget, claimTarget, selected, notifyLoserItem, notificationsOpen]);

  // 3. Clear Notice Banner After 4 Seconds
  useEffect(() => {
    if (notice) {
      const t = window.setTimeout(() => setNotice(''), 4000);
      return () => clearTimeout(t);
    }
  }, [notice]);

  const results = useMemo(
    () => searchItems(items, q, type, category, status),
    [items, q, type, category, status],
  );

  const go = (p: string) => {
    setPage(p);
    setMenu(false);
    setSelected(null);
    try {
      if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch {
      /* ignore smooth scroll in headless tests */
    }
  };

  // Image Selection Handler
  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setNotice('Selected image is too large. Choose an image under 5MB.');
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function removeSelectedImage() {
    setImageFile(null);
    setImagePreview(null);
  }

  // Auth Submission Handler
  async function handleAuthSubmit(e: FormEvent) {
    e.preventDefault();
    setAuthError('');

    const errors = validAuthInput(
      authEmail,
      authMode === 'reset' ? undefined : authPassword,
      authMode === 'signup' ? authName : undefined,
    );

    if (Object.keys(errors).length > 0) {
      setAuthError(Object.values(errors)[0]);
      return;
    }

    setBusy(true);

    if (authMode === 'signup') {
      const { user: newUser, error } = await authService.signUp(authEmail, authPassword, authName);
      setBusy(false);
      if (error) {
        setAuthError(error);
      } else {
        setUser(newUser);
        setAuthOpen(false);
        setNotice(`Account created! Welcome, ${newUser?.displayName || authName}.`);
      }
    } else if (authMode === 'signin') {
      const { user: signedInUser, error } = await authService.signIn(authEmail, authPassword);
      setBusy(false);
      if (error) {
        setAuthError(error);
      } else {
        setUser(signedInUser);
        setAuthOpen(false);
        setNotice(`Signed in as ${signedInUser?.displayName || authEmail}.`);
      }
    } else if (authMode === 'reset') {
      const { error } = await authService.resetPassword(authEmail);
      setBusy(false);
      if (error) {
        setAuthError(error);
      } else {
        setAuthOpen(false);
        setNotice('Password reset link sent to your email.');
      }
    }
  }

  async function handleGoogleSignIn() {
    setBusy(true);
    setAuthError('');
    const { user: signedInUser, error } = await authService.signInWithGoogle();
    setBusy(false);
    if (error) {
      setAuthError(error);
    } else if (signedInUser) {
      setUser(signedInUser);
      setAuthOpen(false);
      setNotice(`Signed in with Google as ${signedInUser.displayName || signedInUser.email}!`);
    }
  }

  async function handleSignOut() {
    await authService.signOut();
    setUser(null);
    setClaims([]);
    setNotice('Signed out successfully.');
  }

  // Item Submission Handler
  async function submitItem(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!user) {
      setAuthOpen(true);
      setAuthMode('signin');
      setNotice('Please sign in or create an account to post a report.');
      return;
    }

    const fd = new FormData(e.currentTarget);
    const draft: Partial<Item> = {
      title: String(fd.get('title') || ''),
      type: formType,
      category: String(fd.get('category') || ''),
      description: String(fd.get('description') || ''),
      color: String(fd.get('color') || ''),
      location: String(fd.get('location') || ''),
      date: String(fd.get('date') || ''),
      time: String(fd.get('time') || ''),
      handover: fd.get('handover') === 'on',
    };

    const nextErrors = validItemInput(draft);
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setBusy(true);

    const { item: createdItem, error } = await itemService.createItem(
      draft,
      imageFile,
      user.id,
      user.displayName || user.email.split('@')[0],
    );

    setBusy(false);

    if (error || !createdItem) {
      setNotice(error || 'Failed to submit report. Please try again.');
      return;
    }

    setItems((prev) => dedupeById([createdItem, ...prev]));
    setImageFile(null);
    setImagePreview(null);
    setNotice('Report published successfully and synchronized with cloud database.');
    go('browse');
    setQ(createdItem.title);
    setType('all');
  }

  // Claim Evidence File Selection Handler
  function handleClaimEvidenceChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setNotice('Evidence photo must be under 5MB.');
      return;
    }

    setClaimEvidenceFile(file);
    const reader = new FileReader();
    reader.onload = () => setClaimEvidencePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function removeClaimEvidence() {
    setClaimEvidenceFile(null);
    setClaimEvidencePreview(null);
  }

  // Claim Submission Handler
  async function submitClaim(e: FormEvent) {
    e.preventDefault();

    if (!user) {
      setAuthOpen(true);
      setAuthMode('signin');
      setNotice('Please sign in to submit an ownership claim.');
      return;
    }

    if (!claimTarget) return;

    const errorMsg = validClaimInput(claimDetails);
    if (errorMsg) {
      setNotice(errorMsg);
      return;
    }

    setBusy(true);

    let finalEvidenceUrl: string | undefined = undefined;
    if (claimEvidenceFile) {
      const uploadRes = await storageService.uploadFile(
        claimEvidenceFile,
        `claims/${claimTarget.id}/${user.id}_${Date.now()}.jpg`,
      );
      if (uploadRes.url) {
        finalEvidenceUrl = uploadRes.url;
      }
    }

    const { claim: newClaim, error } = await claimService.createClaim(
      claimTarget.id,
      claimDetails,
      user.id,
      user.displayName || user.email.split('@')[0],
      claimPhone,
      claimTarget.ownerId,
      claimTarget.title,
      user.email,
      finalEvidenceUrl,
    );

    setBusy(false);

    if (error || !newClaim) {
      setNotice(error || 'Failed to submit claim.');
      return;
    }

    setClaims((prev) => dedupeById([newClaim, ...prev]));
    setClaimDetails('');
    setClaimPhone('');
    setClaimEvidenceFile(null);
    setClaimEvidencePreview(null);
    setClaimTarget(null);
    setNotice('Ownership claim submitted securely. Only the finder and reviewers can inspect verification details.');
    setDashboardTab('my-claims');
    go('dashboard');
  }

  async function changeClaim(id: string, s: ClaimStatus) {
    const { error } = await claimService.updateClaimStatus(id, s);
    if (!error) {
      setClaims((prev) => prev.map((c) => (c.id === id ? { ...c, status: s } : c)));
      setNotice(`Claim status updated to ${s}.`);
    } else {
      setNotice(error);
    }
  }

  // Withdraw / Cancel Claim submitted by current user
  async function handleWithdrawClaim(claimId: string) {
    if (!user) return;
    if (!confirm('Are you sure you want to withdraw this ownership claim?')) return;

    setBusy(true);
    const { error } = await claimService.withdrawClaim(claimId, user.id);
    setBusy(false);

    if (error) {
      setNotice(error);
    } else {
      setClaims((prev) => prev.filter((c) => c.id !== claimId));
      setNotice('Ownership claim withdrawn successfully.');
    }
  }

  // Reviewer Decision: Approve Claim
  async function handleApproveClaim(claim: Claim) {
    if (!user) return;
    setBusy(true);
    const { error } = await claimService.approveClaim(
      claim.id,
      claim.itemId,
      user.id,
      user.displayName || user.email,
    );
    setBusy(false);

    if (error) {
      setNotice(error);
    } else {
      setClaimsReceived((prev) =>
        prev.map((c) => (c.id === claim.id ? { ...c, status: 'Approved' } : c)),
      );
      setItems((prev) =>
        prev.map((i) => (i.id === claim.itemId ? { ...i, status: 'Claim Pending' } : i)),
      );
      setNotice('Claim approved! You can now arrange safe handover with the claimant.');
    }
  }

  // Reviewer Decision: Confirm Physical Return & Handover Complete
  async function handleConfirmReturn(claim: Claim) {
    if (!user) return;
    if (!confirm('Confirm that the item has been safely returned to the verified owner?')) return;

    setBusy(true);
    const { error } = await claimService.confirmReturn(claim.id, claim.itemId, user.id);
    setBusy(false);

    if (error) {
      setNotice(error);
    } else {
      setClaimsReceived((prev) =>
        prev.map((c) =>
          c.id === claim.id
            ? { ...c, status: 'Completed', returnConfirmedBy: user.id }
            : c,
        ),
      );
      setItems((prev) =>
        prev.map((i) => (i.id === claim.itemId ? { ...i, status: 'Recovered' } : i)),
      );
      setNotice('Item handover confirmed! Item status transitioned to Recovered.');
    }
  }

  // Reviewer Decision: Submit Note for More Info or Reject
  async function submitReviewDecision(e: FormEvent) {
    e.preventDefault();
    if (!user || !reviewActionClaim || !reviewActionType) return;

    if (!reviewActionNote.trim()) {
      setNotice('Please enter a note explaining your request or reason.');
      return;
    }

    setBusy(true);
    if (reviewActionType === 'more_info') {
      const { error } = await claimService.requestMoreInfo(
        reviewActionClaim.id,
        user.id,
        user.displayName || user.email,
        reviewActionNote,
      );
      setBusy(false);
      if (error) {
        setNotice(error);
      } else {
        setClaimsReceived((prev) =>
          prev.map((c) =>
            c.id === reviewActionClaim.id
              ? { ...c, status: 'Under Review', resolutionNote: reviewActionNote }
              : c,
          ),
        );
        setNotice('Additional evidence requested from the claimant.');
        setReviewActionClaim(null);
        setReviewActionType(null);
        setReviewActionNote('');
      }
    } else if (reviewActionType === 'reject') {
      const { error } = await claimService.rejectClaim(
        reviewActionClaim.id,
        user.id,
        user.displayName || user.email,
        reviewActionNote,
      );
      setBusy(false);
      if (error) {
        setNotice(error);
      } else {
        setClaimsReceived((prev) =>
          prev.map((c) =>
            c.id === reviewActionClaim.id
              ? { ...c, status: 'Rejected', resolutionNote: reviewActionNote }
              : c,
          ),
        );
        setNotice('Claim has been rejected.');
        setReviewActionClaim(null);
        setReviewActionType(null);
        setReviewActionNote('');
      }
    }
  }

  // Delete own item listing
  async function handleDeleteItem(itemId: string) {
    if (!user) return;
    if (!confirm('Are you sure you want to delete this listing from the database?')) return;

    setBusy(true);
    const { error } = await itemService.deleteItem(itemId);
    setBusy(false);

    if (error) {
      setNotice(error);
    } else {
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      setNotice('Listing removed from campus database.');
    }
  }

  async function closeItem(id: string) {
    const { error } = await itemService.updateItemStatus(id, 'Recovered');
    if (!error) {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: 'Recovered' } : i)));
      setNotice('Item marked recovered in the database.');
      setSelected(null);
    } else {
      setNotice(error);
    }
  }

  // Profile Save Handler
  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (!user) return;

    const errors = validProfileInput(profileName, profilePhone, profileDepartment);
    setProfileErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setBusy(true);
    const { user: updatedUser, error } = await authService.updateUserProfile(user.id, {
      displayName: profileName,
      phoneNumber: profilePhone,
      department: profileDepartment,
      preferredContactMethod: profileContactMethod,
      notificationPreferences: profilePrefs,
      rewardsOptIn: profileRewardsOptIn,
    });
    setBusy(false);

    if (error) {
      setNotice(error);
    } else if (updatedUser) {
      setUser(updatedUser);
      setProfileEditing(false);
      setNotice('Profile updated successfully across your devices!');
    }
  }

  // Edit Report Handlers with State & Audit Safeguards
  function startEditReport(item: Item) {
    if (!user) return;
    if (!canEditReport(item, user.id)) {
      setNotice(`Cannot edit report: Listing status is "${item.status}". Once an item has an active claim or is resolved, modifications are locked for verification integrity.`);
      return;
    }
    setEditingItem(item);
    setEditTitle(item.title);
    setEditCategory(item.category);
    setEditDescription(item.description);
    setEditColor(item.color || '');
    setEditLocation(item.location);
    setEditDate(item.date);
    setEditTime(item.time || '');
    setEditError('');
  }

  async function handleSaveEditReport(e: FormEvent) {
    e.preventDefault();
    if (!user || !editingItem) return;

    const validation = validItemInput({
      title: editTitle,
      category: editCategory,
      description: editDescription,
      location: editLocation,
      date: editDate,
    });
    if (Object.keys(validation).length) {
      setEditError(Object.values(validation)[0]);
      return;
    }

    setBusy(true);
    const { error } = await itemService.updateItemDetails(
      editingItem.id,
      {
        title: editTitle,
        category: editCategory,
        description: editDescription,
        color: editColor,
        location: editLocation,
        date: editDate,
        time: editTime,
      },
      user.id,
    );
    setBusy(false);

    if (error) {
      setEditError(error);
    } else {
      setItems((prev) =>
        prev.map((i) =>
          i.id === editingItem.id
            ? {
                ...i,
                title: editTitle,
                category: editCategory,
                description: editDescription,
                color: editColor,
                location: editLocation,
                date: editDate,
                time: editTime,
                updatedAt: new Date().toISOString(),
              }
            : i,
        ),
      );
      setNotice('Report details updated successfully in the campus database.');
      setEditingItem(null);
    }
  }

  async function handleCancelReport(item: Item) {
    if (!user) return;
    if (!canCancelReport(item, user.id)) {
      setNotice(`Cannot cancel report: Status is "${item.status}". Listings with active claims or completed resolutions cannot be deleted.`);
      return;
    }
    if (!confirm(`Are you sure you want to cancel and remove your ${item.type} report for "${item.title}"?`)) return;

    setBusy(true);
    const { error } = await itemService.cancelReport(item.id, user.id);
    setBusy(false);

    if (error) {
      setNotice(error);
    } else {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setNotice('Report successfully canceled and removed from campus records.');
    }
  }

  // Profile Avatar Upload Handler
  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const validation = storageService.validateImage(file);
    if (validation) {
      setNotice(validation);
      return;
    }

    setAvatarUploading(true);
    const uploadRes = await storageService.uploadProfileAvatar(file, user.id);
    if (uploadRes.error || !uploadRes.url) {
      setAvatarUploading(false);
      setNotice(uploadRes.error || 'Failed to upload avatar photo.');
      return;
    }

    const { user: updatedUser, error } = await authService.updateUserProfile(user.id, {
      avatarUrl: uploadRes.url,
    });
    setAvatarUploading(false);

    if (error) {
      setNotice(error);
    } else if (updatedUser) {
      setUser(updatedUser);
      setNotice('Profile photo updated successfully!');
    }
  }


  // Abuse Report Submission Handler
  async function submitFlagReport(e: FormEvent) {
    e.preventDefault();
    if (!user) {
      setAuthOpen(true);
      setNotice('Please sign in to flag a report.');
      return;
    }
    if (!flagTarget) return;

    const validation = validReportInput(flagReason, flagDetails);
    if (Object.keys(validation).length) {
      setNotice(Object.values(validation)[0]);
      return;
    }

    setBusy(true);
    const { error } = await reportService.submitReport(flagTarget.id, flagReason, user.id, flagDetails);
    setBusy(false);

    if (error) {
      setNotice(error);
    } else {
      setNotice('Report flagged for administrative review. Thank you for keeping campus safe.');
      setFlagTarget(null);
      setFlagDetails('');
    }
  }

  // Development Seeding Handlers
  async function handleSeedDevData() {
    setBusy(true);
    const seedUserId = user?.id || 'demo-admin-seed';
    const seedUserName = user?.displayName || 'Campus Admin';
    const res = await itemService.seedDevData(seedUserId, seedUserName);
    setBusy(false);
    if (res.error) {
      setNotice(res.error);
    } else {
      const refreshed = await itemService.fetchItems();
      setItems(dedupeById(refreshed.items));
      setNotice(`Seeded ${res.inserted} test records clearly labeled [DEMO / TEST DATA].`);
    }
  }

  async function handleCleanupDevData() {
    setBusy(true);
    const res = await itemService.cleanupDevData();
    setBusy(false);
    if (res.error) {
      setNotice(res.error);
    } else {
      const refreshed = await itemService.fetchItems();
      setItems(dedupeById(refreshed.items));
      setNotice('Cleaned up all test records. Real user reports remain untouched.');
    }
  }

  const matchesFor = useMemo(() => (selected ? findMatches(selected, items) : []), [selected, items]);
  const itemMatchesCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) {
      map.set(it.id, findMatches(it, items).length);
    }
    return map;
  }, [items]);

  const myItems = useMemo(
    () =>
      dedupeById(
        items.filter(
          (i) =>
            user &&
            (i.ownerId === user.id ||
              i.owner === 'You (this browser)' ||
              i.owner === user.displayName ||
              i.ownerName === user.displayName),
        ),
      ),
    [items, user],
  );

  const myFoundItems = useMemo(
    () => myItems.filter((i) => i.type === 'found' && i.status !== 'Recovered'),
    [myItems],
  );

  const myLostItems = useMemo(
    () => myItems.filter((i) => i.type === 'lost'),
    [myItems],
  );

  const myAllFoundItems = useMemo(
    () => myItems.filter((i) => i.type === 'found'),
    [myItems],
  );

  const { totalPoints, badges } = useMemo(
    () => calculateUserRewards(rewards),
    [rewards],
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  async function handleNotificationClick(notif: AppNotification) {
    if (!notif.read) {
      await notificationService.markAsRead(notif.id);
      setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)));
    }
    setNotificationsOpen(false);

    if (notif.type === 'claim_submitted') {
      setDashboardTab('claims-received');
      go('dashboard');
    } else if (
      notif.type === 'claim_approved' ||
      notif.type === 'claim_rejected' ||
      notif.type === 'evidence_requested' ||
      notif.type === 'handover_completed'
    ) {
      setDashboardTab('my-claims');
      go('dashboard');
    } else if (notif.foundItemId) {
      const targetFound = items.find((i) => i.id === notif.foundItemId);
      if (targetFound) {
        setSelected(targetFound);
      } else {
        go('browse');
      }
    } else if (notif.itemId) {
      const targetItem = items.find((i) => i.id === notif.itemId);
      if (targetItem) {
        setSelected(targetItem);
      }
    }
  }

  async function submitNotifyMatch(e: FormEvent) {
    e.preventDefault();
    if (!user || !notifyLoserItem) return;

    if (!notifyLoserItem.ownerId) {
      setNotice('Cannot send notification: The owner has not linked an account.');
      return;
    }

    const matchedFoundItem = myFoundItems.find((i) => i.id === notifyFoundItemId);
    const foundItemTitle = matchedFoundItem ? matchedFoundItem.title : 'Matching found item';
    const foundLocation = matchedFoundItem?.location || undefined;

    setBusy(true);
    const { error } = await notificationService.notifyMatchFound({
      loserId: notifyLoserItem.ownerId,
      finderId: user.id,
      finderName: user.displayName || user.email.split('@')[0],
      lostItemId: notifyLoserItem.id,
      lostItemTitle: notifyLoserItem.title,
      foundItemId: notifyFoundItemId || '',
      foundItemTitle,
      foundLocation,
      customNote: notifyCustomNote,
    });
    setBusy(false);

    if (error) {
      setNotice(error);
    } else {
      setNotice(`Notification sent to ${notifyLoserItem.title}'s owner! They will see it in their alerts.`);
      setNotifyLoserItem(null);
      setNotifyFoundItemId('');
      setNotifyCustomNote('');
    }
  }

  return (
    <div className="app-shell">
      {/* Dev Tools & Cloud Status Banner (Visible in Development Mode) */}
      {!import.meta.env.PROD && (
        <div className="dev-banner">
          <div className="cloud-indicator">
            <span className={`cloud-dot ${isFirebaseConfigured ? '' : 'cloud-off'}`} />
            {isFirebaseConfigured ? (
              <span>Google Cloud Firestore Connected (Live Cross-Device Sync)</span>
            ) : (
              <span>Database Disconnected</span>
            )}
          </div>
          <div className="dev-banner-actions">
            <button className="dev-btn" onClick={handleSeedDevData} disabled={busy} title="Insert clearly labeled test records">
              <Database size={11} /> Seed Test Data
            </button>
            <button className="dev-btn danger" onClick={handleCleanupDevData} disabled={busy} title="Delete ONLY test records">
              <RotateCcw size={11} /> Clean Up Test Data
            </button>
          </div>
        </div>
      )}

      {/* Google Cloud API Required Banner (Token Service API Notice) */}
      {tokenNoticeUrl && (
        <div className="token-api-alert" role="alert">
          <AlertTriangle size={15} />
          <div style={{ flex: 1 }}>
            <b>Google Cloud Action Required:</b> The Token Service API (<code>securetoken.googleapis.com</code>) is disabled or propagating in project <code>37299026377</code>. Firestore operates in safe offline mode.
            <a
              href={tokenNoticeUrl}
              target="_blank"
              rel="noreferrer"
              style={{ marginLeft: '8px' }}
            >
              Enable in Google Cloud Console →
            </a>
          </div>
          <button
            className="dev-btn"
            onClick={async () => {
              await authService.clearSession();
              setUser(null);
              setTokenNoticeUrl(null);
              setNotice('Session reset. Please sign in or continue in guest mode.');
            }}
            title="Reset cached auth tokens"
          >
            Reset Session
          </button>
          <button onClick={() => setTokenNoticeUrl(null)} aria-label="Dismiss alert">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Topbar Navigation */}
      <header className="topbar">
        <button className="brand" onClick={() => go('home')} aria-label="CampusFind home">
          <span className="brand-icon">
            <HeartHandshake size={22} />
          </span>
          <span>
            Campus<span className="brand-accent">Find</span>
            <small>LOST & FOUND, TOGETHER</small>
          </span>
        </button>

        <button className="mobile-menu" onClick={() => setMenu(!menu)} aria-label="Toggle navigation">
          <Menu />
        </button>

        <nav className={menu ? 'nav open' : 'nav'}>
          <button onClick={() => go('browse')}>Explore items</button>
          <button onClick={() => go('how')}>How it works</button>
          {user && (
            <button onClick={() => go('dashboard')}>
              Dashboard <span className="nav-count">{myItems.length + claimsReceived.length}</span>
            </button>
          )}
          <button
            onClick={() => {
              setDashboardTab('my-claims');
              go('dashboard');
            }}
          >
            My claims <span className="nav-count">{claims.length}</span>
          </button>
          <button
            className="nav-cta"
            onClick={() => {
              setFormType('lost');
              go('report');
            }}
          >
            <Plus size={16} /> Report an item
          </button>

          {/* User Authentication Menu */}
          <div className="user-menu">
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* In-app Notifications Bell & Dropdown */}
                <div className="notification-bell-wrap">
                  <button
                    className="notification-bell-btn"
                    onClick={() => setNotificationsOpen(!notificationsOpen)}
                    aria-label="View notifications"
                    title={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
                  >
                    <Bell size={15} />
                    {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
                  </button>
                  {notificationsOpen && (
                    <div className="notification-dropdown">
                      <div className="notification-header">
                        <h3><Bell size={14} /> Notifications</h3>
                        {unreadCount > 0 && (
                          <button
                            className="mark-all-read-btn"
                            onClick={async () => {
                              await notificationService.markAllAsRead(notifications);
                              setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
                            }}
                          >
                            Mark all read
                          </button>
                        )}
                      </div>
                      <div className="notification-list">
                        {notifications.length ? (
                          notifications.map((n) => {
                            let iconClass = 'notification-icon-box';
                            let icon = <Bell size={15} />;
                            if (n.type === 'match_alert') {
                              iconClass += ' match';
                              icon = <HeartHandshake size={15} />;
                            } else if (n.type === 'claim_approved' || n.type === 'handover_completed') {
                              iconClass += ' approved';
                              icon = <CheckCircle2 size={15} />;
                            } else if (n.type === 'claim_rejected') {
                              iconClass += ' rejected';
                              icon = <AlertTriangle size={15} />;
                            } else if (n.type === 'evidence_requested') {
                              icon = <Clock size={15} />;
                            }

                            return (
                              <button
                                key={n.id}
                                className={`notification-item ${n.read ? '' : 'unread'}`}
                                onClick={() => handleNotificationClick(n)}
                              >
                                <div className={iconClass}>{icon}</div>
                                <div className="notification-content">
                                  <div className="notification-title">
                                    <span>{n.title}</span>
                                    {!n.read && (
                                      <span
                                        style={{
                                          width: 6,
                                          height: 6,
                                          borderRadius: '50%',
                                          background: '#659146',
                                          display: 'inline-block',
                                        }}
                                      />
                                    )}
                                  </div>
                                  <p className="notification-msg">{n.message}</p>
                                  <span className="notification-time">
                                    {new Date(n.createdAt).toLocaleDateString()} ·{' '}
                                    {new Date(n.createdAt).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </div>
                              </button>
                            );
                          })
                        ) : (
                          <div className="notification-empty">
                            <Bell size={24} style={{ color: '#a0af9f' }} />
                            <span>No notifications yet</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  className="user-pill"
                  onClick={() => go('profile')}
                  title={`Signed in as ${user.email} · View Profile`}
                  style={{ cursor: 'pointer' }}
                >
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt=""
                      style={{ width: 14, height: 14, borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    <User size={13} />
                  )}
                  <span>{user.displayName || user.email.split('@')[0]}</span>
                </button>
                <button
                  onClick={handleSignOut}
                  aria-label="Sign out"
                  title="Sign out"
                  style={{ background: 'none', border: 0, padding: 0, display: 'grid', color: '#687e6b' }}
                >
                  <LogOut size={13} />
                </button>
              </div>
            ) : (
              <button
                className="auth-nav-btn"
                onClick={() => {
                  setAuthMode('signin');
                  setAuthOpen(true);
                }}
              >
                Sign In
              </button>
            )}
          </div>
        </nav>
      </header>


      {/* Notification Toast */}
      {notice && (
        <div role="status" className="toast">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
          <button onClick={() => setNotice('')} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Home Page */}
      {page === 'home' && (
        <>
          <section className="hero">
            <div className="hero-copy">
              <div className="eyebrow">
                <span className="live-dot" /> YOUR CAMPUS, CONNECTED
              </div>
              <h1>
                Lost something?
                <br />
                <em>Let’s bring it back.</em>
              </h1>
              <p className="hero-text">
                A verified, cloud-synced campus community platform. Report misplaced belongings, check explainable matches,
                and recover items safely through staffed campus desks.
              </p>
              <div className="hero-actions">
                <button
                  className="button primary"
                  onClick={() => {
                    setFormType('lost');
                    go('report');
                  }}
                >
                  <Search size={17} /> I lost something
                </button>
                <button
                  className="button secondary"
                  onClick={() => {
                    setFormType('found');
                    go('report');
                  }}
                >
                  <Plus size={17} /> I found something
                </button>
              </div>
              <div className="trust-line">
                <ShieldCheck size={17} /> Authenticated Ownership <span>·</span> Cloud Synchronized
              </div>
            </div>

            <div className="hero-art">
              <div className="art-orbit orbit-one" />
              <div className="art-orbit orbit-two" />
              <div className="art-card card-back">
                <div className="mini-lines" />
                <div className="mini-lines short" />
                <div className="card-dot" />
              </div>
              <div className="art-card card-front">
                <div className="card-top">
                  <span className="tiny-logo">
                    <HeartHandshake size={16} />
                  </span>
                  <span>FOUND IT!</span>
                </div>
                <div className="key-illustration">
                  <KeyRound size={65} strokeWidth={1.35} />
                </div>
                <div className="art-card-bottom">
                  <b>Keys, reunited.</b>
                  <small>Every little thing matters.</small>
                </div>
              </div>
              <div className="floating-tag tag-found">
                <CheckCircle2 size={16} /> Verified Reports
              </div>
              <div className="floating-tag tag-safe">
                <ShieldCheck size={17} />
                <span>
                  <b>Safe handover</b>
                  <small>Meet on campus</small>
                </span>
              </div>
              <div className="art-spark spark-a">✳</div>
              <div className="art-spark spark-b">✦</div>
            </div>
          </section>

          <section className="search-strip">
            <div className="search-intro">
              <span className="search-icon">
                <Search size={20} />
              </span>
              <div>
                <b>Start your search</b>
                <small>It might be closer than you think.</small>
              </div>
            </div>
            <form
              className="quick-search"
              onSubmit={(e) => {
                e.preventDefault();
                go('browse');
              }}
            >
              <Search size={19} />
              <input
                aria-label="Search items"
                placeholder="Try ‘blue notebook’ or ‘library’..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button className="button primary" type="submit">
                Search <ArrowRight size={16} />
              </button>
            </form>
          </section>

          <section className="section-wrap">
            <div className="section-heading">
              <div>
                <span className="eyebrow">A COMMUNITY THAT CARES</span>
                <h2>
                  Small things. <em>Big relief.</em>
                </h2>
                <p>Browse real-time listings submitted by fellow students and campus staff.</p>
              </div>
              <button className="text-link" onClick={() => go('browse')}>
                View all items <ArrowRight size={16} />
              </button>
            </div>
            <div className="item-grid">
              {loading ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px' }}>
                  <Loader2 className="animate-spin" size={28} style={{ margin: 'auto', color: '#688e4c' }} />
                  <p style={{ fontSize: '12px', color: '#7a887b', marginTop: '10px' }}>Loading campus reports...</p>
                </div>
              ) : (
                items
                  .filter((i) => !['Closed', 'Recovered'].includes(i.status))
                  .slice(0, 3)
                  .map((item) => (
                    <ItemCard key={item.id} item={item} onOpen={() => setSelected(item)} />
                  ))
              )}
            </div>
          </section>

          <section className="steps-band">
            <div className="steps-title">
              <span className="eyebrow">IT’S SIMPLE</span>
              <h2>
                Three steps to
                <br />
                <em>reunited.</em>
              </h2>
            </div>
            <div className="step">
              <span className="step-num">01</span>
              <div className="step-icon">
                <Search />
              </div>
              <h3>Search or report</h3>
              <p>Look through reports or add a few helpful details about your item.</p>
            </div>
            <div className="step">
              <span className="step-num">02</span>
              <div className="step-icon">
                <HeartHandshake />
              </div>
              <h3>Spot a possible match</h3>
              <p>Compare details with transparent, explainable heuristic scores.</p>
            </div>
            <div className="step">
              <span className="step-num">03</span>
              <div className="step-icon">
                <CheckCircle2 />
              </div>
              <h3>Meet & reunite</h3>
              <p>Verify ownership privately and arrange a safe campus handover.</p>
            </div>
          </section>
        </>
      )}

      {/* Browse Page */}
      {page === 'browse' && (
        <main className="page-wrap">
          <PageIntro
            eyebrow="THE CAMPUS BOARD"
            title="Find your missing piece."
            subtitle="Search reports, narrow the list, and check possible matches."
          />

          <div className="filters-panel">
            <div className="big-search">
              <Search />
              <input
                placeholder="Search title, color, description or place"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Search reports"
              />
            </div>
            <div className="filter-row">
              <label>
                <span>
                  <Filter size={14} /> Report type
                </span>
                <select value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="all">Lost & found</option>
                  <option value="lost">Lost items</option>
                  <option value="found">Found items</option>
                </select>
              </label>
              <label>
                <span>Category</span>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="all">All categories</option>
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Status</span>
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="all">All statuses</option>
                  {['Open', 'Possible Match', 'Claim Pending', 'Recovered', 'Closed'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <button
                className="clear-btn"
                onClick={() => {
                  setQ('');
                  setType('all');
                  setCategory('all');
                  setStatus('all');
                }}
              >
                <RotateCcw size={14} /> Clear filters
              </button>
            </div>
          </div>

          <div className="results-heading">
            <span>
              <b>{results.length}</b> {results.length === 1 ? 'report' : 'reports'} found
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="button primary compact" onClick={() => go('report')}>
                <Plus size={16} /> Add a report
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px' }}>
              <Loader2 className="animate-spin" size={32} style={{ margin: 'auto', color: '#688e4c' }} />
              <p style={{ fontSize: '13px', color: '#7a887b', marginTop: '12px' }}>Loading reports...</p>
            </div>
          ) : results.length ? (
            <div className="item-grid">
              {results.map((item) => (
                <ItemCard key={item.id} item={item} onOpen={() => setSelected(item)} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <PackageSearch size={38} />
              <h3>No reports found just yet</h3>
              <p>Try a different search or clear your filters.</p>
              <button
                className="button secondary"
                onClick={() => {
                  setQ('');
                  setType('all');
                  setCategory('all');
                  setStatus('all');
                }}
              >
                Clear filters
              </button>
            </div>
          )}
        </main>
      )}

      {/* Report Form Page */}
      {page === 'report' && (
        <main className="page-wrap narrow">
          <button className="back-link" onClick={() => go('browse')}>
            ← Back to reports
          </button>
          <PageIntro
            eyebrow="HELP YOUR COMMUNITY"
            title={formType === 'lost' ? 'Report a lost item.' : 'Report a found item.'}
            subtitle="Share useful visible features. Never include full ID numbers or financial details publicly."
          />

          {!user && (
            <div className="privacy-note" style={{ background: '#fcf6ec', borderColor: '#f4dec1', color: '#97641c' }}>
              <ShieldCheck size={18} />
              <p>
                <b>Authentication Required:</b> You must be signed in to create listings so ownership and updates can be
                verified securely.{' '}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signin');
                    setAuthOpen(true);
                  }}
                  style={{ background: 'none', border: 0, color: '#476f33', fontWeight: 700, textDecoration: 'underline' }}
                >
                  Sign in or create an account
                </button>
              </p>
            </div>
          )}

          <div className="type-switch">
            <button className={formType === 'lost' ? 'selected' : ''} onClick={() => setFormType('lost')}>
              <Search size={17} /> I lost something
            </button>
            <button className={formType === 'found' ? 'selected' : ''} onClick={() => setFormType('found')}>
              <Plus size={17} /> I found something
            </button>
          </div>

          <form className="report-form" onSubmit={submitItem} noValidate>
            <div className="form-grid">
              <Field label="Item title" error={formErrors.title}>
                <input
                  name="title"
                  placeholder={formType === 'lost' ? 'e.g. Black wireless earphones' : 'e.g. Blue notebook'}
                  maxLength={100}
                  required
                />
              </Field>
              <Field label="Category" error={formErrors.category}>
                <select name="category" defaultValue="" required>
                  <option value="" disabled>
                    Select category
                  </option>
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Description" wide error={formErrors.description}>
                <textarea
                  name="description"
                  rows={4}
                  placeholder="Describe visible features. Do not post full ID numbers or sensitive information."
                  maxLength={2000}
                  required
                />
              </Field>
              <Field label="Color / visible details">
                <input name="color" placeholder="e.g. Navy blue, silver trim" maxLength={100} />
              </Field>
              <Field label={formType === 'lost' ? 'Last seen near' : 'Found near'} error={formErrors.location}>
                <input
                  name="location"
                  placeholder="e.g. Engineering block, library"
                  maxLength={150}
                  required
                />
              </Field>
              <Field label={formType === 'lost' ? 'Date lost' : 'Date found'} error={formErrors.date}>
                <input
                  name="date"
                  type="date"
                  max={getTodayDateString()}
                  defaultValue={getTodayDateString()}
                  required
                />
              </Field>
              <Field label="Approximate time (optional)">
                <input name="time" type="time" />
              </Field>

              {/* Real Image Upload */}
              <div className="field wide">
                <span>Upload Item Image (Optional, max 5MB)</span>
                {imagePreview ? (
                  <div className="image-preview-card">
                    <img src={imagePreview} alt="Item preview" />
                    <button type="button" className="image-remove-btn" onClick={removeSelectedImage} aria-label="Remove image">
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <div className="file-upload-box">
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImageChange} />
                    <div className="file-upload-inner">
                      <Upload size={22} />
                      <b>Click or drag an image here</b>
                      <small>PNG, JPG or WebP up to 5MB</small>
                    </div>
                  </div>
                )}
              </div>

              {formType === 'found' && (
                <label className="check-field">
                  <input name="handover" type="checkbox" />{' '}
                  <span>Already handed over to campus security / an authorized office</span>
                </label>
              )}
            </div>

            <div className="privacy-note">
              <ShieldCheck size={18} />
              <p>
                <b>Security & Privacy:</b> All listings are stored in the cloud database. Do not upload photos of government
                identity cards, credit cards, or personal documents.
              </p>
            </div>

            <button className="button primary submit-button" type="submit" disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="animate-spin" size={17} /> Saving to cloud...
                </>
              ) : (
                <>
                  Submit report <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>
        </main>
      )}

      {/* Personal Request Dashboard (My Reports, My Claims, Claims Received) */}
      {(page === 'dashboard' || page === 'claims') && (
        <main className="page-wrap">
          <div className="dashboard-header">
            <div>
              <span className="eyebrow">PERSONAL MANAGEMENT</span>
              <h1>Request Dashboard</h1>
              <p>Manage your reported items, track submitted ownership claims, and verify incoming claims from finders.</p>
            </div>
            <button
              className="button primary"
              onClick={() => {
                setFormType('lost');
                go('report');
              }}
            >
              <Plus size={16} /> New report
            </button>
          </div>

          {/* Responsive Dashboard Tabs */}
          <div className="dashboard-tabs" style={{ marginBottom: '24px' }}>
            <button
              className={`dashboard-tab ${dashboardTab === 'my-reports' || dashboardTab === 'lost-reports' ? 'active' : ''}`}
              onClick={() => setDashboardTab('lost-reports')}
            >
              <PackageSearch size={15} /> Lost Reports
              <span className="tab-badge">{myLostItems.length}</span>
            </button>
            <button
              className={`dashboard-tab ${dashboardTab === 'found-reports' ? 'active' : ''}`}
              onClick={() => setDashboardTab('found-reports')}
            >
              <PackageSearch size={15} /> Found Reports
              <span className="tab-badge">{myAllFoundItems.length}</span>
            </button>
            <button
              className={`dashboard-tab ${dashboardTab === 'my-claims' ? 'active' : ''}`}
              onClick={() => setDashboardTab('my-claims')}
            >
              <Send size={15} /> Submitted Claims
              <span className="tab-badge">{claims.length}</span>
            </button>
            <button
              className={`dashboard-tab ${dashboardTab === 'claims-received' ? 'active' : ''}`}
              onClick={() => setDashboardTab('claims-received')}
            >
              <Inbox size={15} /> Received Claims
              <span className="tab-badge">{claimsReceived.length}</span>
            </button>
            <button
              className={`dashboard-tab ${dashboardTab === 'rewards' ? 'active' : ''}`}
              onClick={() => setDashboardTab('rewards')}
            >
              <Award size={15} /> Rewards & Badges
              <span className="tab-badge">{totalPoints} pts</span>
            </button>
          </div>

          {/* TAB 1: LOST REPORTS */}
          {(dashboardTab === 'my-reports' || dashboardTab === 'lost-reports') && (
            <div>
              {myLostItems.length ? (
                <div className="dashboard-list">
                  {myLostItems.map((item) => {
                    const matchesCount = itemMatchesCountMap.get(item.id) || 0;
                    const isEditable = canEditReport(item, user?.id);
                    const isCancelable = canCancelReport(item, user?.id);
                    return (
                      <article className="dashboard-card" key={item.id}>
                        <div className="dashboard-card-main">
                          {item.imageUrl || item.image ? (
                            <img src={item.imageUrl || item.image} alt={item.title} className="dashboard-card-thumb" />
                          ) : (
                            <div className="dashboard-card-icon">
                              <PackageSearch size={28} />
                            </div>
                          )}
                          <div className="dashboard-card-info">
                            <div className="dashboard-card-meta">
                              <span className="type-pill lost">LOST REPORT</span>
                              <span className="status-pill">{item.status}</span>
                              {item.isDemo && <span className="demo-tag">DEMO</span>}
                            </div>
                            <h3 className="dashboard-card-title">{item.title}</h3>
                            <p className="dashboard-card-desc">{item.description}</p>
                            <div className="dashboard-card-facts">
                              <span>
                                <MapPin size={13} /> {item.location}
                              </span>
                              <span>
                                <CalendarDays size={13} /> {item.date}
                              </span>
                              <span>
                                <HeartHandshake size={13} />{' '}
                                <b>{matchesCount}</b> possible {matchesCount === 1 ? 'match' : 'matches'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="dashboard-actions">
                          <button className="button secondary" onClick={() => setSelected(item)}>
                            <Eye size={14} /> View & matches
                          </button>
                          {item.status !== 'Recovered' && item.status !== 'Closed' && (
                            <button className="button primary" onClick={() => closeItem(item.id)}>
                              <Check size={14} /> Mark recovered
                            </button>
                          )}
                          {isEditable ? (
                            <button className="button secondary" onClick={() => startEditReport(item)}>
                              <Edit3 size={14} /> Edit report
                            </button>
                          ) : (
                            <span
                              className="button secondary"
                              style={{ opacity: 0.6, cursor: 'not-allowed', fontSize: '11px', padding: '9px 13px' }}
                              title={`Locked: Status is "${item.status}". Reports with active claims or resolutions are locked for audit safety.`}
                            >
                              <Lock size={13} /> Edit locked
                            </span>
                          )}
                          {isCancelable ? (
                            <button
                              className="button ghost"
                              onClick={() => handleCancelReport(item)}
                              style={{ color: '#b5483d' }}
                            >
                              <Trash2 size={14} /> Cancel report
                            </button>
                          ) : (
                            <span
                              className="button ghost"
                              style={{ opacity: 0.5, cursor: 'not-allowed', fontSize: '11px', color: '#889689' }}
                              title={`Protected: Report status is "${item.status}" and must be preserved for audit safety.`}
                            >
                              <Lock size={13} /> Deletion locked
                            </span>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <PackageSearch size={38} />
                  <h3>No lost reports created yet</h3>
                  <p>Misplaced something on campus? File a lost report so finders can match and safely return your belongings.</p>
                  <button
                    className="button primary"
                    onClick={() => {
                      setFormType('lost');
                      go('report');
                    }}
                  >
                    Report lost item <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: FOUND REPORTS */}
          {dashboardTab === 'found-reports' && (
            <div>
              {myAllFoundItems.length ? (
                <div className="dashboard-list">
                  {myAllFoundItems.map((item) => {
                    const isEditable = canEditReport(item, user?.id);
                    const isCancelable = canCancelReport(item, user?.id);
                    const incomingClaims = claimsReceived.filter((c) => c.itemId === item.id);
                    return (
                      <article className="dashboard-card" key={item.id}>
                        <div className="dashboard-card-main">
                          {item.imageUrl || item.image ? (
                            <img src={item.imageUrl || item.image} alt={item.title} className="dashboard-card-thumb" />
                          ) : (
                            <div className="dashboard-card-icon" style={{ background: '#e9f1ed', color: '#3b715f' }}>
                              <PackageSearch size={28} />
                            </div>
                          )}
                          <div className="dashboard-card-info">
                            <div className="dashboard-card-meta">
                              <span className="type-pill found">FOUND LISTING</span>
                              <span className="status-pill">{item.status}</span>
                              {item.handover && (
                                <span style={{ fontSize: '10px', color: '#3d6c42', background: '#e9f4e6', padding: '3px 7px', borderRadius: '4px', fontWeight: 700 }}>
                                  AT CAMPUS DESK
                                </span>
                              )}
                              {item.isDemo && <span className="demo-tag">DEMO</span>}
                            </div>
                            <h3 className="dashboard-card-title">{item.title}</h3>
                            <p className="dashboard-card-desc">{item.description}</p>
                            <div className="dashboard-card-facts">
                              <span>
                                <MapPin size={13} /> {item.location}
                              </span>
                              <span>
                                <CalendarDays size={13} /> {item.date}
                              </span>
                              <span>
                                <Inbox size={13} />{' '}
                                <b>{incomingClaims.length}</b> {incomingClaims.length === 1 ? 'claim' : 'claims'} received
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="dashboard-actions">
                          <button className="button secondary" onClick={() => setSelected(item)}>
                            <Eye size={14} /> View listing
                          </button>
                          {item.status !== 'Recovered' && item.status !== 'Closed' && (
                            <button className="button primary" onClick={() => closeItem(item.id)}>
                              <Check size={14} /> Mark returned
                            </button>
                          )}
                          {isEditable ? (
                            <button className="button secondary" onClick={() => startEditReport(item)}>
                              <Edit3 size={14} /> Edit details
                            </button>
                          ) : (
                            <span
                              className="button secondary"
                              style={{ opacity: 0.6, cursor: 'not-allowed', fontSize: '11px', padding: '9px 13px' }}
                              title={`Locked: Status is "${item.status}". Found items with claims or completed handovers are locked.`}
                            >
                              <Lock size={13} /> Edit locked
                            </span>
                          )}
                          {isCancelable ? (
                            <button
                              className="button ghost"
                              onClick={() => handleCancelReport(item)}
                              style={{ color: '#b5483d' }}
                            >
                              <Trash2 size={14} /> Cancel listing
                            </button>
                          ) : (
                            <span
                              className="button ghost"
                              style={{ opacity: 0.5, cursor: 'not-allowed', fontSize: '11px', color: '#889689' }}
                              title={`Protected: Report status is "${item.status}" and must be preserved for audit safety.`}
                            >
                              <Lock size={13} /> Deletion locked
                            </span>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <PackageSearch size={38} />
                  <h3>No found items posted yet</h3>
                  <p>Found something on campus? Register it to help the owner reclaim it safely and earn community reward points!</p>
                  <button
                    className="button primary"
                    onClick={() => {
                      setFormType('found');
                      go('report');
                    }}
                  >
                    Report found item <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SUBMITTED CLAIMS */}
          {dashboardTab === 'my-claims' && (
            <div>
              {claims.length ? (
                <div className="dashboard-list">
                  {claims.map((c) => {
                    const relatedItem = items.find((i) => i.id === c.itemId);
                    const canWithdraw = canWithdrawClaim(c, user?.id);
                    return (
                      <article className="dashboard-card" key={c.id}>
                        <div className="dashboard-card-main">
                          <div className="dashboard-card-icon" style={{ background: '#f0f4e9' }}>
                            <HeartHandshake size={28} />
                          </div>
                          <div className="dashboard-card-info">
                            <div className="dashboard-card-meta">
                              <span className="status-pill">{c.status}</span>
                              <span style={{ fontSize: '11px', color: '#889689' }}>
                                Submitted {new Date(c.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <h3 className="dashboard-card-title">{relatedItem?.title || c.itemTitle || 'Item Listing'}</h3>
                            <p className="dashboard-card-desc">
                              <b>Your verification claim:</b> {c.details}
                            </p>
                            {c.contactPhone && (
                              <p style={{ fontSize: '11px', color: '#687e6b', margin: '4px 0' }}>
                                Contact phone: {c.contactPhone}
                              </p>
                            )}
                            {c.evidenceUrl && (
                              <div style={{ marginTop: '8px' }}>
                                <a
                                  href={c.evidenceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ fontSize: '11px', color: '#527843', fontWeight: 700 }}
                                >
                                  View attached proof photo →
                                </a>
                              </div>
                            )}
                            {c.resolutionNote && (
                              <div className="claim-review-box">
                                <b>Note from finder / reviewer:</b>
                                <p>{c.resolutionNote}</p>
                              </div>
                            )}

                            {/* Unlocked Finder Handover Details upon Claim Approval */}
                            {c.status === 'Approved' && (
                              <div className="handover-unlocked-card">
                                <CheckCircle2 size={16} />
                                <div>
                                  <b>Claim Approved! Finder Handover Details:</b>
                                  <p>
                                    Finder / Reviewer:{' '}
                                    <b>{c.reviewerName || relatedItem?.ownerName || relatedItem?.owner || 'Campus Finder'}</b>
                                  </p>
                                  {relatedItem?.location && (
                                    <p>Found location: <b>{relatedItem.location}</b></p>
                                  )}
                                  <p className="handover-tip">
                                    Campus Handover Protocol: For safety and mutual trust, meet at an authorized campus front desk, library desk, or campus security office.
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="dashboard-actions">
                          {relatedItem && (
                            <button className="button secondary" onClick={() => setSelected(relatedItem)}>
                              <Eye size={14} /> View listing
                            </button>
                          )}
                          {canWithdraw ? (
                            <button className="button ghost" onClick={() => handleWithdrawClaim(c.id)}>
                              Withdraw claim
                            </button>
                          ) : (
                            <span
                              className="button ghost"
                              style={{ opacity: 0.6, cursor: 'not-allowed', fontSize: '11px', color: '#889689' }}
                              title={`Safeguard: Status is "${c.status}". Once approved or completed, claims cannot be withdrawn.`}
                            >
                              <Lock size={12} /> Claim locked
                            </span>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <HeartHandshake size={38} />
                  <h3>No claims submitted yet</h3>
                  <p>When you see a found item that belongs to you on the campus board, submit a private claim to verify ownership.</p>
                  <button
                    className="button primary"
                    onClick={() => {
                      setType('found');
                      go('browse');
                    }}
                  >
                    Browse found items <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: CLAIMS RECEIVED (Items you found, claimed by others) */}
          {dashboardTab === 'claims-received' && (
            <div>
              {claimsReceived.length ? (
                <div className="dashboard-list">
                  {claimsReceived.map((c) => {
                    const relatedItem = items.find((i) => i.id === c.itemId);
                    return (
                      <article className="dashboard-card" key={c.id}>
                        <div className="dashboard-card-main">
                          <div className="dashboard-card-icon" style={{ background: '#e9f1ed', color: '#3b715f' }}>
                            <Inbox size={28} />
                          </div>
                          <div className="dashboard-card-info">
                            <div className="dashboard-card-meta">
                              <span className="status-pill">{c.status}</span>
                              <span style={{ fontSize: '11px', color: '#889689' }}>
                                Received {new Date(c.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <h3 className="dashboard-card-title">
                              Claim on: “{relatedItem?.title || c.itemTitle || 'Your found listing'}”
                            </h3>
                            <p style={{ fontSize: '11px', color: '#44604e', margin: '4px 0 8px' }}>
                              Claimant: <b>{c.claimantName || c.claimant || 'Campus Member'}</b>
                              {c.claimantEmail && ` (${c.claimantEmail})`}
                              {c.contactPhone && ` · Phone: ${c.contactPhone}`}
                            </p>
                            <div style={{ background: '#f9faf6', border: '1px solid #e5ecd9', borderRadius: '8px', padding: '10px 12px' }}>
                              <b style={{ fontSize: '11px', color: '#3f5d47', display: 'block', marginBottom: '4px' }}>
                                Private Ownership Verification Proof:
                              </b>
                              <p style={{ margin: 0, fontSize: '12px', color: '#5f7365', lineHeight: 1.6 }}>
                                {c.details}
                              </p>
                            </div>
                            {c.evidenceUrl && (
                              <div style={{ marginTop: '10px' }}>
                                <img
                                  src={c.evidenceUrl}
                                  alt="Claimant Proof"
                                  style={{ maxHeight: '120px', borderRadius: '8px', border: '1px solid #dce4d5' }}
                                />
                              </div>
                            )}
                            {c.resolutionNote && (
                              <div className="claim-review-box">
                                <b>Your reviewer note:</b>
                                <p>{c.resolutionNote}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Reviewer Action Buttons */}
                        <div className="dashboard-actions">
                          {(c.status === 'Pending' || c.status === 'Under Review') && (
                            <>
                              <button className="button primary" onClick={() => handleApproveClaim(c)}>
                                <Check size={14} /> Approve claim
                              </button>
                              <button
                                className="button secondary"
                                onClick={() => {
                                  setReviewActionClaim(c);
                                  setReviewActionType('more_info');
                                  setReviewActionNote('');
                                }}
                              >
                                Request evidence
                              </button>
                              <button
                                className="button ghost"
                                onClick={() => {
                                  setReviewActionClaim(c);
                                  setReviewActionType('reject');
                                  setReviewActionNote('');
                                }}
                                style={{ color: '#b94b3e' }}
                              >
                                Reject claim
                              </button>
                            </>
                          )}
                          {c.status === 'Approved' && (
                            <button className="button primary" onClick={() => handleConfirmReturn(c)}>
                              <CheckCircle2 size={14} /> Confirm return (+50 pts)
                            </button>
                          )}
                          {c.status === 'Completed' && (
                            <span style={{ fontSize: '11px', color: '#567a42', fontWeight: 700, textAlign: 'center' }}>
                              ✓ Return completed (+50 pts earned)
                            </span>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <Inbox size={38} />
                  <h3>No claims received yet</h3>
                  <p>When someone submits an ownership claim for an item you found, their private verification proof will appear here for your review.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: REWARDS & HONESTY RECOGNITION */}
          {dashboardTab === 'rewards' && (
            <div>
              {/* Header Points Summary */}
              <div className="rewards-header-card">
                <div className="rewards-header-copy">
                  <span className="eyebrow" style={{ color: '#d8f27d' }}>CAMPUS HONESTY & TRUST RECOGNITION</span>
                  <h2>Community Reward Points</h2>
                  <p>
                    CampusFind honors honest finders who take the time to reconnect students with lost belongings.
                    Points are verified through real handover completions and stored in an immutable community ledger.
                  </p>
                </div>
                <div className="rewards-points-pill">
                  <b>{totalPoints}</b>
                  <small>Verified Points</small>
                </div>
              </div>

              {/* Anti-Gaming Eligibility Rules Banner */}
              <div className="eligibility-rules-banner">
                <ShieldCheck size={22} />
                <div>
                  <b>Eligibility & Anti-Gaming Integrity Rules</b>
                  <p>
                    Points are awarded exclusively for <b>verified helpful actions</b>:
                    reuniting an item with its confirmed owner (+50 pts), turning in a verified item at campus security (+25 pts),
                    or providing match notifications that result in verified recovery (+15 pts).
                    Points are <b>never awarded</b> merely for posting reports or submitting self-claims. Duplicate rewards for the same item are blocked.
                  </p>
                </div>
              </div>

              {/* Achievement Badges Grid */}
              <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ font: '800 18px Manrope', margin: 0, color: 'var(--deep)' }}>
                  Achievement Badges & Recognition
                </h3>
                <span style={{ fontSize: '12px', color: '#6d7f72' }}>
                  {badges.filter((b) => b.unlocked).length} of {badges.length} Unlocked
                </span>
              </div>

              <div className="badges-grid">
                {badges.map((b) => (
                  <div className={`badge-card ${b.unlocked ? 'unlocked' : 'locked'}`} key={b.id}>
                    <span className="badge-icon">{b.icon}</span>
                    <h4>{b.name}</h4>
                    <p>{b.description}</p>
                    <span className={`badge-status ${b.unlocked ? 'unlocked' : 'locked'}`}>
                      {b.unlocked ? 'Unlocked' : `${totalPoints}/${b.minPoints} pts`}
                    </span>
                    {b.unlocked && (
                      <button
                        className="button secondary badge-cert-btn"
                        onClick={() => setSelectedCertificateBadge(b)}
                      >
                        <FileCheck size={13} /> View Certificate
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Rewards Points Ledger History */}
              <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ font: '800 18px Manrope', margin: 0, color: 'var(--deep)' }}>
                  Points Transaction Ledger
                </h3>
                <span style={{ fontSize: '11px', color: '#7b8c80' }}>
                  Immutable Audit History ({rewards.length} {rewards.length === 1 ? 'entry' : 'entries'})
                </span>
              </div>

              <div className="rewards-ledger-wrap">
                {rewards.length ? (
                  <table className="rewards-ledger-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Action</th>
                        <th>Item / Reference</th>
                        <th>Points</th>
                        <th>Audit Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rewards.map((r) => (
                        <tr key={r.id}>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {new Date(r.createdAt).toLocaleDateString()}
                          </td>
                          <td>
                            <span className="type-pill found" style={{ textTransform: 'uppercase' }}>
                              {r.action.replace('_', ' ')}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600 }}>{r.targetTitle || r.targetId}</td>
                          <td className="points-positive">+{r.points} pts</td>
                          <td style={{ color: '#5f7365' }}>{r.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ textAlign: 'center', padding: '36px 20px', color: '#7a8c7e' }}>
                    <Sparkles size={32} style={{ color: '#8aa65b', margin: '0 auto 10px', display: 'block' }} />
                    <b style={{ display: 'block', fontSize: '14px', color: 'var(--deep)', marginBottom: '4px' }}>
                      No point transactions recorded yet
                    </b>
                    <p style={{ margin: 0, fontSize: '12px', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
                      When you find an item on campus, approve a rightful claim, and confirm the item handover,
                      your 50 verified reward points will be recorded here!
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      )}

      {/* Dedicated User Profile Page */}
      {page === 'profile' && user && (
        <main className="page-wrap">
          <PageIntro
            eyebrow="CAMPUS PROFILE"
            title="User Profile & Settings"
            subtitle="Manage your public campus contact preferences, avatar photo, and real-time notification alerts."
          />

          <div className="profile-layout">
            {/* Left Column: Sidebar Summary */}
            <aside className="profile-sidebar">
              <div className="profile-avatar-wrap">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.displayName} className="profile-avatar" />
                ) : (
                  <div className="profile-avatar-placeholder">
                    {user.displayName?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
                <label className="avatar-upload-label" title="Upload new photo">
                  <Camera size={15} />
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAvatarUpload}
                    disabled={avatarUploading}
                  />
                </label>
              </div>

              {avatarUploading && (
                <small style={{ color: '#547942', display: 'block', marginBottom: '8px' }}>
                  Uploading avatar...
                </small>
              )}

              <h2 className="profile-name">{user.displayName || 'Campus Member'}</h2>
              <p className="profile-email">{user.email}</p>
              <span className={`role-badge ${user.role}`}>{user.role || 'Student'}</span>

              <div className="profile-stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <div className="profile-stat-box">
                  <b>{myItems.length}</b>
                  <small>Reports</small>
                </div>
                <div className="profile-stat-box">
                  <b>{claims.length}</b>
                  <small>Claims</small>
                </div>
                <div className="profile-stat-box">
                  <b style={{ color: '#447833' }}>{totalPoints}</b>
                  <small>Points</small>
                </div>
              </div>

              <div className="profile-shortcuts">
                <button
                  className="profile-shortcut-link"
                  onClick={() => {
                    setDashboardTab('lost-reports');
                    go('dashboard');
                  }}
                >
                  <span>Lost Reports ({myLostItems.length})</span>
                  <ArrowRight size={13} />
                </button>
                <button
                  className="profile-shortcut-link"
                  onClick={() => {
                    setDashboardTab('found-reports');
                    go('dashboard');
                  }}
                >
                  <span>Found Reports ({myAllFoundItems.length})</span>
                  <ArrowRight size={13} />
                </button>
                <button
                  className="profile-shortcut-link"
                  onClick={() => {
                    setDashboardTab('my-claims');
                    go('dashboard');
                  }}
                >
                  <span>Submitted Claims ({claims.length})</span>
                  <ArrowRight size={13} />
                </button>
                <button
                  className="profile-shortcut-link"
                  onClick={() => {
                    setDashboardTab('claims-received');
                    go('dashboard');
                  }}
                >
                  <span>Received Claims ({claimsReceived.length})</span>
                  <ArrowRight size={13} />
                </button>
                <button
                  className="profile-shortcut-link"
                  onClick={() => {
                    setDashboardTab('rewards');
                    go('dashboard');
                  }}
                >
                  <span style={{ fontWeight: 800, color: '#3d6c35' }}>Honesty Rewards & Badges</span>
                  <ArrowRight size={13} />
                </button>
                <button className="profile-shortcut-link" onClick={() => go('browse')}>
                  <span>Browse Campus Board</span>
                  <ArrowRight size={13} />
                </button>
              </div>

              <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #edf0e7' }}>
                <button
                  className="button secondary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={handleSignOut}
                >
                  <LogOut size={14} /> Sign out of account
                </button>
              </div>
            </aside>

            {/* Right Column: Editable Profile & Preferences */}
            <section className="profile-main-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h2 className="profile-section-title">Personal Information</h2>
                  <p className="profile-section-sub">
                    Visible to campus members when coordinating safe handovers.
                  </p>
                </div>
                {!profileEditing && (
                  <button className="button secondary" onClick={() => setProfileEditing(true)}>
                    <Edit3 size={14} /> Edit profile
                  </button>
                )}
              </div>

              <form onSubmit={handleSaveProfile}>
                <div className="profile-form-grid">
                  <label className="field">
                    <span>Display name</span>
                    <input
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      disabled={!profileEditing}
                      required
                    />
                    {profileErrors.displayName && <small className="field-error">{profileErrors.displayName}</small>}
                  </label>

                  <label className="field">
                    <span>Phone number (optional)</span>
                    <input
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                      placeholder="+1 555-0199"
                      disabled={!profileEditing}
                    />
                    {profileErrors.phoneNumber && <small className="field-error">{profileErrors.phoneNumber}</small>}
                  </label>

                  <label className="field wide">
                    <span>Department / Campus Office / Major</span>
                    <input
                      value={profileDepartment}
                      onChange={(e) => setProfileDepartment(e.target.value)}
                      placeholder="e.g. Computer Science / Science Building Rm 302"
                      disabled={!profileEditing}
                    />
                    {profileErrors.department && <small className="field-error">{profileErrors.department}</small>}
                  </label>

                  <label className="field wide">
                    <span>Preferred contact method</span>
                    <select
                      value={profileContactMethod}
                      onChange={(e) => setProfileContactMethod(e.target.value as any)}
                      disabled={!profileEditing}
                    >
                      <option value="email">Campus Email ({user.email})</option>
                      <option value="phone">Phone / WhatsApp</option>
                      <option value="in_person">In-Person at Campus Desk</option>
                    </select>
                  </label>
                </div>

                {/* Notification Preferences */}
                <div className="pref-toggles">
                  <h3 style={{ font: '700 15px Manrope', margin: '0 0 10px', color: '#173d31' }}>
                    Notification Preferences
                  </h3>
                  <label className="pref-toggle-row">
                    <div className="pref-toggle-info">
                      <b>Possible matches alert</b>
                      <small>Email me when items matching my lost reports are found.</small>
                    </div>
                    <input
                      type="checkbox"
                      className="pref-toggle-input"
                      checked={profilePrefs.emailMatches ?? true}
                      disabled={!profileEditing}
                      onChange={(e) =>
                        setProfilePrefs((prev) => ({ ...prev, emailMatches: e.target.checked }))
                      }
                    />
                  </label>
                  <label className="pref-toggle-row">
                    <div className="pref-toggle-info">
                      <b>Claim status updates</b>
                      <small>Notify me when my submitted ownership claim is approved or reviewed.</small>
                    </div>
                    <input
                      type="checkbox"
                      className="pref-toggle-input"
                      checked={profilePrefs.claimUpdates ?? true}
                      disabled={!profileEditing}
                      onChange={(e) =>
                        setProfilePrefs((prev) => ({ ...prev, claimUpdates: e.target.checked }))
                      }
                    />
                  </label>
                  <label className="pref-toggle-row">
                    <div className="pref-toggle-info">
                      <b>New claims received</b>
                      <small>Notify me when someone claims an item I posted on the board.</small>
                    </div>
                    <input
                      type="checkbox"
                      className="pref-toggle-input"
                      checked={profilePrefs.newClaimsReceived ?? true}
                      disabled={!profileEditing}
                      onChange={(e) =>
                        setProfilePrefs((prev) => ({ ...prev, newClaimsReceived: e.target.checked }))
                      }
                    />
                  </label>
                  <label className="pref-toggle-row">
                    <div className="pref-toggle-info">
                      <b>Participate in Campus Honesty Rewards System (Optional)</b>
                      <small>Earn verified community reward points, achievement badges, and recognition certificates when returning items.</small>
                    </div>
                    <input
                      type="checkbox"
                      className="pref-toggle-input"
                      checked={profileRewardsOptIn}
                      disabled={!profileEditing}
                      onChange={(e) => setProfileRewardsOptIn(e.target.checked)}
                    />
                  </label>
                </div>

                {profileEditing && (
                  <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                    <button className="button primary" type="submit" disabled={busy}>
                      {busy ? 'Saving...' : 'Save changes'}
                    </button>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => {
                        setProfileEditing(false);
                        setProfileName(user.displayName || '');
                        setProfilePhone(user.phoneNumber || '');
                        setProfileDepartment(user.department || '');
                        setProfileContactMethod(user.preferredContactMethod || 'email');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </form>

              {/* Account Security & Firestore Details */}
              <div className="account-security-card">
                <h3 style={{ font: '700 14px Manrope', margin: '0 0 10px', color: '#173d31' }}>
                  Account Details
                </h3>
                <div className="account-meta-item">
                  <span>Firebase User ID</span>
                  <b>{user.id}</b>
                </div>
                <div className="account-meta-item">
                  <span>Account Email</span>
                  <b>{user.email}</b>
                </div>
                <div className="account-meta-item">
                  <span>Campus Role</span>
                  <b style={{ textTransform: 'capitalize' }}>{user.role}</b>
                </div>
                <div className="account-meta-item">
                  <span>Member Since</span>
                  <b>{new Date(user.createdAt).toLocaleDateString()}</b>
                </div>
              </div>
            </section>
          </div>
        </main>
      )}


      {/* How it Works Page */}
      {page === 'how' && (
        <main className="page-wrap">
          <PageIntro
            eyebrow="SAFETY FIRST"
            title="A safer way to reunite."
            subtitle="CampusFind is designed to make reporting easy while keeping ownership checks private."
          />
          <div className="safety-grid">
            <article>
              <ShieldCheck />
              <h3>Keep proof private</h3>
              <p>
                Don't publish full ID numbers, serial numbers, or sensitive documents. Ask claimants to describe hidden
                identifying features privately.
              </p>
            </article>
            <article>
              <MapPin />
              <h3>Choose a safe handover</h3>
              <p>
                For valuables or uncertain claims, use a staffed campus security office or authorized front desk on campus.
              </p>
            </article>
            <article>
              <AlertTriangle />
              <h3>Verified authenticity</h3>
              <p>
                Listings and claims require student authentication and Row-Level Security, protecting private claims from public
                exposure.
              </p>
            </article>
          </div>
          <div className="how-cta">
            <div>
              <h2>Lost something on campus?</h2>
              <p>Start with a report. A few helpful details can make a difference.</p>
            </div>
            <button className="button primary" onClick={() => go('report')}>
              Create a report <ArrowRight size={16} />
            </button>
          </div>
        </main>
      )}

      <Footer go={go} />

      {/* Item Details Modal */}
      {selected && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <section className="detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title">
            <button className="modal-close" onClick={() => setSelected(null)} aria-label="Close details">
              <X />
            </button>

            <span className={'type-pill ' + selected.type}>
              {selected.type === 'lost' ? 'LOST ITEM' : 'FOUND ITEM'}
            </span>
            <span className="status-pill">{selected.status}</span>
            {selected.isDemo && <span className="demo-tag">DEMO DATA</span>}

            <h2 id="detail-title">{selected.title}</h2>

            {/* Display Real Uploaded Image if Present */}
            {selected.imageUrl || selected.image ? (
              <img src={selected.imageUrl || selected.image} alt={selected.title} className="detail-img-cover" />
            ) : null}

            <p className="detail-description">{selected.description}</p>

            <div className="detail-facts">
              <span title="Report ID">
                <ShieldCheck size={16} /> ID: #{selected.id.slice(0, 8)}
              </span>
              <span>
                <PackageSearch size={16} />
                {selected.category}
              </span>
              {selected.color && (
                <span>
                  <span className="color-dot" />
                  {selected.color}
                </span>
              )}
              <span>
                <MapPin size={16} />
                {selected.location}
              </span>
              <span>
                <CalendarDays size={16} />
                {selected.date} {selected.time ? `· ${selected.time}` : ''}
              </span>
              {selected.createdAt && (
                <span title="Report timestamp">
                  <Clock size={16} />
                  Reported {new Date(selected.createdAt).toLocaleDateString()}
                </span>
              )}
              <span title="Poster Verification">
                <User size={16} />
                {user && (user.id === selected.ownerId || selected.owner === user.displayName)
                  ? 'Reported by You'
                  : `Reported by: ${selected.ownerName || 'Verified Member'}${selected.ownerId ? ` (ID: ${selected.ownerId.slice(0, 6)}...)` : ''}`}
              </span>
            </div>

            {selected.handover && (
              <p className="handover-note">
                <ShieldCheck size={16} /> Item was handed to campus security / authorized front desk.
              </p>
            )}

            {/* Explainable Possible Matches */}
            <div className="match-box">
              <h3>
                <HeartHandshake size={18} /> Possible matches
              </h3>
              {matchesFor.length ? (
                matchesFor.map((m) => (
                  <button className="match-row" key={m.item.id} onClick={() => setSelected(m.item)}>
                    <span>
                      <b>{m.item.title}</b>
                      <small>
                        {m.item.location} · {m.item.date}
                      </small>
                      <small>Why: {m.reasons.join(', ') || 'Some details overlap'}</small>
                    </span>
                    <span className="match-score">
                      {m.score}%<small>heuristic</small>
                    </span>
                  </button>
                ))
              ) : (
                <p className="muted">No strong potential matches in the current reports yet.</p>
              )}
              <p className="match-disclaimer">Scores are simple heuristic comparisons, not proof of ownership.</p>
            </div>

            <div className="modal-actions">
              {/* Action 1: Found item -> Submit Claim */}
              {selected.type === 'found' && selected.status !== 'Recovered' && (
                user && user.id === selected.ownerId ? (
                  <button
                    className="button secondary"
                    onClick={() => {
                      setDashboardTab('claims-received');
                      go('dashboard');
                      setSelected(null);
                    }}
                  >
                    <Inbox size={15} /> View Claims Received
                  </button>
                ) : (
                  <button
                    className="button primary"
                    onClick={() => {
                      if (!user) {
                        setAuthOpen(true);
                        setNotice('Please sign in to submit an ownership claim.');
                      } else {
                        setClaimTarget(selected);
                        setSelected(null);
                      }
                    }}
                  >
                    This Is My Item — Submit Claim
                  </button>
                )
              )}

              {/* Action 2: Lost item -> Finder notifies Loser */}
              {selected.type === 'lost' && selected.status !== 'Recovered' && (
                user && user.id === selected.ownerId ? (
                  <span style={{ fontSize: '11px', color: '#687e6b' }}>
                    You reported losing this item. We will alert you when matches are reported.
                  </span>
                ) : (
                  <button
                    className="button primary"
                    onClick={() => {
                      if (!user) {
                        setAuthOpen(true);
                        setNotice('Please sign in to notify the owner of a matching item.');
                      } else {
                        setNotifyLoserItem(selected);
                        setNotifyCustomNote('');
                        setNotifyFoundItemId(myFoundItems[0]?.id || '');
                        setSelected(null);
                      }
                    }}
                  >
                    <HeartHandshake size={15} /> I Found a Matching Item — Notify Owner
                  </button>
                )
              )}

              {user &&
                (user.id === selected.ownerId ||
                  selected.owner === 'You (this browser)' ||
                  selected.owner === user.displayName) &&
                selected.status !== 'Recovered' && (
                  <button className="button secondary" onClick={() => closeItem(selected.id)}>
                    Mark recovered
                  </button>
                )}

              <button
                className="button ghost"
                onClick={() => {
                  setFlagTarget(selected);
                  setSelected(null);
                }}
              >
                <Flag size={14} /> Flag report
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Finder-to-Loser Match Notification Modal */}
      {notifyLoserItem && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setNotifyLoserItem(null);
          }}
        >
          <section className="detail-modal" role="dialog" aria-modal="true" aria-labelledby="notify-loser-title">
            <button className="modal-close" onClick={() => setNotifyLoserItem(null)} aria-label="Close modal">
              <X />
            </button>
            <span className="eyebrow" style={{ color: '#496b42' }}>
              REUNITE OWNER & FINDER
            </span>
            <h2 id="notify-loser-title">Found a match for “{notifyLoserItem.title}”?</h2>
            <div className="privacy-note">
              <ShieldCheck size={18} />
              <p>
                Notify the person who reported losing this item. They will receive an in-app alert with a link to view your
                found item report and submit an ownership verification claim.
              </p>
            </div>
            <form onSubmit={submitNotifyMatch}>
              <div style={{ marginBottom: '16px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#465d4e',
                    display: 'block',
                    marginBottom: '6px',
                  }}
                >
                  Select which found item you are connecting:
                </span>
                {myFoundItems.length > 0 ? (
                  <select
                    value={notifyFoundItemId}
                    onChange={(e) => setNotifyFoundItemId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '11px',
                      borderRadius: '8px',
                      border: '1px solid #dfe6da',
                      background: '#fff',
                      fontSize: '12px',
                    }}
                  >
                    <option value="">-- Choose one of your found listings (or leave unselected) --</option>
                    {myFoundItems.map((fi) => (
                      <option key={fi.id} value={fi.id}>
                        {fi.title} ({fi.category} · {fi.location})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p style={{ fontSize: '11px', color: '#6e7e72', margin: '4px 0' }}>
                    Tip: You haven't posted a found report yet. You can still message the owner directly below!
                  </p>
                )}
              </div>

              <label className="field" style={{ marginBottom: '20px' }}>
                <span>Message or Handover Desk Details for the Owner</span>
                <textarea
                  value={notifyCustomNote}
                  onChange={(e) => setNotifyCustomNote(e.target.value)}
                  rows={4}
                  required
                  placeholder="e.g. I found an item matching your description near the Library 2nd floor, and handed it to campus security desk."
                  maxLength={1000}
                />
              </label>

              <button className="button primary submit-button" type="submit" disabled={busy}>
                {busy ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                Send match alert to owner
              </button>
            </form>
          </section>
        </div>
      )}

      {/* Claim Submission Modal */}
      {claimTarget && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setClaimTarget(null);
          }}
        >
          <section className="detail-modal claim-modal" role="dialog" aria-modal="true" aria-labelledby="claim-title">
            <button className="modal-close" onClick={() => setClaimTarget(null)} aria-label="Close claim">
              <X />
            </button>
            <span className="eyebrow">OWNERSHIP CHECK</span>
            <h2 id="claim-title">Claim “{claimTarget.title}”</h2>
            <div className="privacy-note">
              <ShieldCheck size={18} />
              <p>
                Describe a distinctive feature only the true owner would know. These verification details are visible only
                to the finder and designated campus reviewers.
              </p>
            </div>
            <form onSubmit={submitClaim}>
              <label className="field">
                <span>Contact phone / preferred reaching method (optional)</span>
                <input
                  value={claimPhone}
                  onChange={(e) => setClaimPhone(e.target.value)}
                  placeholder="e.g. +1 555-0199 or WhatsApp"
                  maxLength={50}
                />
              </label>
              <label className="field">
                <span>Private identifying details</span>
                <textarea
                  value={claimDetails}
                  onChange={(e) => setClaimDetails(e.target.value)}
                  rows={4}
                  placeholder="What unique marking, wallpaper, sticker, or contents verify this belongs to you?"
                  required
                  minLength={12}
                  maxLength={1500}
                />
              </label>

              {/* Optional Photo Proof / Evidence Upload */}
              <div style={{ marginTop: '14px', marginBottom: '18px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#465d4e', display: 'block', marginBottom: '6px' }}>
                  Supporting photo / receipt / proof of ownership (optional)
                </span>
                {claimEvidencePreview ? (
                  <div className="image-preview-card" style={{ marginTop: '6px' }}>
                    <img src={claimEvidencePreview} alt="Evidence preview" />
                    <button type="button" className="image-remove-btn" onClick={removeClaimEvidence} aria-label="Remove photo">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="file-upload-box" style={{ marginTop: '6px' }}>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleClaimEvidenceChange}
                    />
                    <div className="file-upload-inner">
                      <Camera size={18} />
                      <span>Attach proof photo or receipt</span>
                      <small style={{ color: '#8b978e' }}>JPG, PNG or WebP under 5MB</small>
                    </div>
                  </div>
                )}
              </div>

              <button className="button primary submit-button" type="submit" disabled={busy}>
                {busy ? 'Submitting claim...' : 'Submit verification claim'} <ArrowRight size={16} />
              </button>
            </form>
          </section>
        </div>
      )}

      {/* Reviewer Action Note Modal (Request more info / Reject) */}
      {reviewActionClaim && reviewActionType && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setReviewActionClaim(null);
              setReviewActionType(null);
            }
          }}
        >
          <section className="detail-modal auth-modal" role="dialog" aria-modal="true">
            <button
              className="modal-close"
              onClick={() => {
                setReviewActionClaim(null);
                setReviewActionType(null);
              }}
              aria-label="Close dialog"
            >
              <X />
            </button>
            <span className="eyebrow" style={{ color: reviewActionType === 'more_info' ? '#5a7e48' : '#b8493d' }}>
              {reviewActionType === 'more_info' ? 'VERIFICATION INQUIRY' : 'CLAIM RESOLUTION'}
            </span>
            <h2>
              {reviewActionType === 'more_info'
                ? 'Request Additional Evidence'
                : 'Reject Ownership Claim'}
            </h2>
            <p style={{ fontSize: '12px', color: '#6d7c71', margin: '8px 0 16px' }}>
              Claimant: <b>{reviewActionClaim.claimantName || reviewActionClaim.claimant}</b>
            </p>
            <form onSubmit={submitReviewDecision}>
              <label className="field" style={{ marginBottom: '20px' }}>
                <span>
                  {reviewActionType === 'more_info'
                    ? 'What specific feature or proof do you need them to clarify?'
                    : 'Reason for rejection (e.g. details did not correspond to found item)'}
                </span>
                <textarea
                  value={reviewActionNote}
                  onChange={(e) => setReviewActionNote(e.target.value)}
                  rows={4}
                  required
                  placeholder={
                    reviewActionType === 'more_info'
                      ? 'e.g. Please describe the stickers on the back or specify what is inside the front pouch...'
                      : 'e.g. Details provided do not correspond to the found item.'
                  }
                />
              </label>
              <button className="button primary submit-button" type="submit" disabled={busy}>
                {busy ? 'Saving...' : reviewActionType === 'more_info' ? 'Send Request' : 'Confirm Rejection'}
              </button>
            </form>
          </section>
        </div>
      )}


      {/* Flag / Abuse Report Modal */}
      {flagTarget && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setFlagTarget(null);
          }}
        >
          <section className="detail-modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="flag-title">
            <button className="modal-close" onClick={() => setFlagTarget(null)} aria-label="Close flag dialog">
              <X />
            </button>
            <span className="eyebrow" style={{ color: '#b95043' }}>
              COMMUNITY SAFEGUARD
            </span>
            <h2 id="flag-title">Report listing</h2>
            <p style={{ fontSize: '12px', color: '#6d7c71', margin: '8px 0 16px' }}>
              Reporting “{flagTarget.title}” for administrative or moderation review.
            </p>
            <form onSubmit={submitFlagReport}>
              <label className="field" style={{ marginBottom: '14px' }}>
                <span>Reason</span>
                <select value={flagReason} onChange={(e) => setFlagReason(e.target.value)}>
                  <option value="Contains personal/sensitive info">Contains personal or sensitive info</option>
                  <option value="Spam or commercial listing">Spam or commercial advertisement</option>
                  <option value="Fraudulent or suspicious claim">Fraudulent or suspicious claim</option>
                  <option value="Inappropriate or abusive language">Inappropriate or abusive language</option>
                  <option value="Item already returned/resolved">Item already returned / resolved</option>
                </select>
              </label>
              <label className="field" style={{ marginBottom: '20px' }}>
                <span>Additional details (optional)</span>
                <textarea
                  value={flagDetails}
                  onChange={(e) => setFlagDetails(e.target.value)}
                  rows={3}
                  placeholder="Provide any additional context for campus administrators."
                  maxLength={500}
                />
              </label>
              <button className="button primary submit-button" type="submit" disabled={busy}>
                {busy ? 'Submitting...' : 'Submit Report for Moderation'}
              </button>
            </form>
          </section>
        </div>
      )}

      {/* Edit Report Modal with Audit Safeguards */}
      {editingItem && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEditingItem(null);
          }}
        >
          <section className="detail-modal" role="dialog" aria-modal="true" aria-labelledby="edit-report-title">
            <button className="modal-close" onClick={() => setEditingItem(null)} aria-label="Close edit dialog">
              <X />
            </button>
            <span className="eyebrow">EDIT REPORT</span>
            <h2 id="edit-report-title">
              Edit {editingItem.type === 'lost' ? 'Lost Report' : 'Found Listing'}
            </h2>
            <div className="privacy-note" style={{ background: '#f5f7ee', borderColor: '#dbe3cc' }}>
              <ShieldCheck size={18} />
              <p>
                <b>Cloud Audit Safeguard:</b> Updates to this report synchronize across all devices.
                Status is <b>{editingItem.status}</b>.
              </p>
            </div>

            {editError && <div className="auth-error">{editError}</div>}

            <form onSubmit={handleSaveEditReport}>
              <div className="form-grid">
                <Field label="Item title" wide>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    maxLength={100}
                    required
                  />
                </Field>

                <Field label="Category">
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    required
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Color / visible features">
                  <input
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    placeholder="e.g. Navy blue, matte"
                    maxLength={100}
                  />
                </Field>

                <Field label="Location" wide>
                  <input
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    maxLength={150}
                    required
                  />
                </Field>

                <Field label="Date">
                  <input
                    type="date"
                    value={editDate}
                    max={getTodayDateString()}
                    onChange={(e) => setEditDate(e.target.value)}
                    required
                  />
                </Field>

                <Field label="Approximate time (optional)">
                  <input
                    type="time"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                  />
                </Field>

                <Field label="Detailed description" wide>
                  <textarea
                    rows={4}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    maxLength={2000}
                    required
                  />
                </Field>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button className="button primary submit-button" type="submit" disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" size={16} /> : 'Save report updates'}
                </button>
                <button className="button secondary" type="button" onClick={() => setEditingItem(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Milestone Digital Certificate of Appreciation Modal */}
      {selectedCertificateBadge && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelectedCertificateBadge(null);
          }}
        >
          <div className="certificate-modal" role="dialog" aria-modal="true" aria-labelledby="cert-title">
            <button
              className="modal-close"
              onClick={() => setSelectedCertificateBadge(null)}
              aria-label="Close certificate"
            >
              <X />
            </button>

            <div className="certificate-frame">
              <div className="certificate-seal">
                <Medal size={34} />
              </div>

              <div className="certificate-institution">
                CAMPUSFIND · HONOR & COMMUNITY INTEGRITY NETWORK
              </div>

              <h2 className="certificate-title" id="cert-title">
                Certificate of Appreciation
              </h2>

              <p className="certificate-subtitle">
                This official recognition is gratefully presented to
              </p>

              <div className="certificate-recipient">
                {user?.displayName || 'Campus Honored Member'}
              </div>

              <p className="certificate-reason">
                For exceptional honesty, civic responsibility, and active dedication to reuniting
                lost belongings on campus. In recognition of achieving the{' '}
                <b>{selectedCertificateBadge.name}</b> community milestone with{' '}
                <b>{totalPoints} verified community points</b>.
              </p>

              <div className="certificate-meta-row">
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '10px', color: '#88988b' }}>VERIFICATION CODE</div>
                  <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#173d31' }}>
                    CF-{(user?.id || 'CAMPUS').slice(0, 8).toUpperCase()}-{selectedCertificateBadge.id.toUpperCase()}
                  </div>
                  <div style={{ fontSize: '10px', color: '#7a8c7e', marginTop: '4px' }}>
                    Issued: {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div className="certificate-sig-line">Campus Committee</div>
                  <small style={{ fontSize: '10px', color: '#88988b' }}>Lost & Found Authority</small>
                </div>
              </div>
            </div>

            <div className="modal-actions" style={{ justifyContent: 'center', marginTop: '24px' }}>
              <button
                className="button primary"
                onClick={() => {
                  try {
                    window.print();
                  } catch (e) {
                    console.warn('Print dialog notice:', e);
                  }
                }}
              >
                <Printer size={15} /> Print / Save as PDF
              </button>
              <button className="button secondary" onClick={() => setSelectedCertificateBadge(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Real Authentication Modal */}
      {authOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAuthOpen(false);
          }}
        >
          <section className="detail-modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
            <button className="modal-close" onClick={() => setAuthOpen(false)} aria-label="Close login dialog">
              <X />
            </button>

            <div className="auth-tabs">
              <button
                className={`auth-tab ${authMode === 'signin' ? 'active' : ''}`}
                onClick={() => {
                  setAuthMode('signin');
                  setAuthError('');
                }}
              >
                Sign In
              </button>
              <button
                className={`auth-tab ${authMode === 'signup' ? 'active' : ''}`}
                onClick={() => {
                  setAuthMode('signup');
                  setAuthError('');
                }}
              >
                Create Account
              </button>
              <button
                className={`auth-tab ${authMode === 'reset' ? 'active' : ''}`}
                onClick={() => {
                  setAuthMode('reset');
                  setAuthError('');
                }}
              >
                Reset
              </button>
            </div>

            <h2 id="auth-title">
              {authMode === 'signin' && 'Welcome back'}
              {authMode === 'signup' && 'Join CampusFind'}
              {authMode === 'reset' && 'Reset your password'}
            </h2>

            {authError && (
              <div className="auth-error">
                {authError.includes('securetoken.googleapis.com') || authError.includes('Token Service API') ? (
                  <div style={{ textAlign: 'left', lineHeight: 1.5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, marginBottom: '6px', color: '#b94b3e' }}>
                      <AlertTriangle size={16} />
                      <span>Google Cloud API Activation Required</span>
                    </div>
                    <p style={{ margin: '0 0 8px 0', fontSize: '12px' }}>
                      Token Service API (<b>securetoken.googleapis.com</b>) must be enabled in your Google Cloud project (<b>37299026377</b>):
                    </p>
                    <ol style={{ margin: '0 0 10px 18px', padding: 0, fontSize: '11px', color: '#444' }}>
                      <li>Click the button below to visit Google Cloud Console</li>
                      <li>Click <b>Enable API</b></li>
                      <li>Wait 1–2 minutes for Google's systems to propagate, then retry</li>
                    </ol>
                    <a
                      href="https://console.developers.google.com/apis/api/securetoken.googleapis.com/overview?project=37299026377"
                      target="_blank"
                      rel="noreferrer"
                      className="button primary compact"
                      style={{ fontSize: '12px', padding: '8px 12px', width: '100%', justifyContent: 'center', textAlign: 'center', textDecoration: 'none', display: 'flex', boxSizing: 'border-box' }}
                    >
                      Enable Token Service API in Google Cloud →
                    </a>
                  </div>
                ) : authError.includes('Firebase Console') || authError.includes('Sign-in method') || authError.includes('operation-not-allowed') ? (
                  <div style={{ textAlign: 'left', lineHeight: 1.5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, marginBottom: '6px', color: '#b94b3e' }}>
                      <AlertTriangle size={16} />
                      <span>Firebase Email/Password Setup Required</span>
                    </div>
                    <p style={{ margin: '0 0 8px 0', fontSize: '12px' }}>
                      Email/Password authentication must be enabled in your Firebase Console project (<b>concise-ground-v01dl</b>):
                    </p>
                    <ol style={{ margin: '0 0 10px 18px', padding: 0, fontSize: '11px', color: '#444' }}>
                      <li>Open Firebase Console &gt; <b>Authentication</b> &gt; <b>Sign-in method</b> tab</li>
                      <li>Click <b>Email/Password</b></li>
                      <li>Toggle <b>Enable</b> to ON and click <b>Save</b></li>
                    </ol>
                    <div style={{ marginTop: '10px' }}>
                      <button
                        type="button"
                        className="button primary compact"
                        onClick={handleGoogleSignIn}
                        disabled={busy}
                        style={{ fontSize: '12px', padding: '6px 12px', width: '100%', justifyContent: 'center' }}
                      >
                        Use Google Sign-In Right Now (No Setup Needed)
                      </button>
                    </div>
                  </div>
                ) : (
                  authError
                )}
              </div>
            )}

            <button
              type="button"
              className="google-auth-btn"
              onClick={handleGoogleSignIn}
              disabled={busy}
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path
                  fill="#4285F4"
                  d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.616z"
                />
                <path
                  fill="#34A853"
                  d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
                />
                <path
                  fill="#FBBC05"
                  d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"
                />
                <path
                  fill="#EA4335"
                  d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="auth-divider">or continue with email</div>

            <form onSubmit={handleAuthSubmit}>
              {authMode === 'signup' && (
                <label className="field" style={{ marginBottom: '14px' }}>
                  <span>Your Name</span>
                  <input
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="e.g. Alex Morgan"
                    required
                  />
                </label>
              )}

              <label className="field" style={{ marginBottom: '14px' }}>
                <span>Campus / Personal Email</span>
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="name@university.edu"
                  required
                />
              </label>

              {authMode !== 'reset' && (
                <label className="field" style={{ marginBottom: '20px' }}>
                  <span>Password</span>
                  <input
                    type="password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    minLength={6}
                  />
                </label>
              )}

              <button className="button primary submit-button" type="submit" disabled={busy}>
                {busy ? (
                  <Loader2 className="animate-spin" size={17} />
                ) : authMode === 'signin' ? (
                  'Sign In'
                ) : authMode === 'signup' ? (
                  'Create Account'
                ) : (
                  'Send Reset Link'
                )}
              </button>

              <div className="auth-switch">
                {authMode === 'signin' ? (
                  <>
                    Don't have an account?{' '}
                    <button type="button" onClick={() => setAuthMode('signup')}>
                      Create one
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{' '}
                    <button type="button" onClick={() => setAuthMode('signin')}>
                      Sign in
                    </button>
                  </>
                )}
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  wide,
  error,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
  error?: string;
}) {
  return (
    <label className={'field' + (wide ? ' wide' : '')}>
      <span>{label}</span>
      {children}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}

function ItemCard({ item, onOpen }: { item: Item; onOpen: () => void }) {
  const Icon = icons[item.category] || PackageSearch;
  const hasImage = Boolean(item.imageUrl || item.image);

  return (
    <article className="item-card">
      <div className={'item-visual ' + item.type}>
        {hasImage ? (
          <img src={item.imageUrl || item.image} alt={item.title} className="item-img-cover" />
        ) : (
          <>
            <div className="visual-top">
              <span className={'type-pill ' + item.type}>{item.type === 'lost' ? 'LOST' : 'FOUND'}</span>
              <span className="visual-date">{item.date}</span>
            </div>
            <div className="visual-icon">
              <Icon size={40} strokeWidth={1.4} />
            </div>
            <span className="visual-category">{item.category}</span>
          </>
        )}
      </div>
      <div className="item-card-body">
        <div className="item-card-title">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {item.title}
            {item.isDemo && <span className="demo-tag">DEMO</span>}
          </h3>
          <span className="status-dot" title={item.status} />
        </div>
        <p>{item.description}</p>
        <div className="item-meta">
          <span>
            <MapPin size={14} />
            {item.location}
          </span>
          <span>
            <CalendarDays size={14} />
            {item.date}
          </span>
        </div>
        <button className="card-link" onClick={onOpen}>
          View details <ArrowRight size={15} />
        </button>
      </div>
    </article>
  );
}

function PageIntro({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div className="page-intro">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  );
}

function Footer({ go }: { go: (p: string) => void }) {
  return (
    <footer className="footer">
      <div className="footer-main">
        <button className="brand footer-brand" onClick={() => go('home')}>
          <span className="brand-icon">
            <HeartHandshake size={22} />
          </span>
          <span>
            Campus<span className="brand-accent">Find</span>
            <small>LOST & FOUND, TOGETHER</small>
          </span>
        </button>
        <p>
          Good things find their way back.
          <br />
          One campus, a little more connected.
        </p>
        <div className="footer-links">
          <button onClick={() => go('how')}>About & safety</button>
          <button onClick={() => go('browse')}>Browse reports</button>
          <button onClick={() => go('report')}>Report an item</button>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 CampusFind · Cloud-Synced Platform</span>
        <span className="demo-label">
          <span /> {isFirebaseConfigured ? 'CONNECTED TO GOOGLE CLOUD FIRESTORE' : 'DATABASE DISCONNECTED'}
        </span>
      </div>
    </footer>
  );
}
