import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { IoAlbumsOutline, IoListOutline, IoGridOutline, IoSearchOutline, IoRefreshOutline } from "react-icons/io5";
import { supabase } from "../../lib/supabase";
import RecipeCard from "../components/RecipeCard";
import Toast from "../components/Toast";
import "./Homepage.css";

export default function HomePage() {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(null);
  const [currentUserAvatar, setCurrentUserAvatar] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem("viewMode") || "card");
  const [categoriesMap, setCategoriesMap] = useState({});
  const [profilesMap, setProfilesMap] = useState({});
  const [savedRecipeIds, setSavedRecipeIds] = useState(new Set());

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // add to state declarations
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  const [showAppModal, setShowAppModal] = useState(false);
  const toastTimer = useRef(null);

  const fetchProfiles = async (userIds) => {
    if (!userIds.length) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .in("id", userIds);
    if (error) {
      console.log("profiles fetch error:", error);
      return;
    }
    const map = {};
    data.forEach((p) => {
      map[p.id] = { username: p.username, avatar_url: p.avatar_url };
    });
    setProfilesMap(map);
  };

  // Public recipes are always fetched, logged in or not — this is the
  // web app's discovery surface. Private recipes only get added on top
  // if someone happens to be signed in.
  const fetchRecipes = useCallback(async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    setCurrentUser(user || null);

    if (user) {
      const { data: myProfile } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", user.id)
        .single();
      if (myProfile) setCurrentUserAvatar(myProfile.avatar_url);
    }

    const publicPromise = supabase
      .from("recipes")
      .select("*")
      .eq("is_public", true)
      .order("created_at", { ascending: false });

    const privatePromise = user
      ? supabase
          .from("recipes")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_public", false)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] });

    const [publicData, privateData] = await Promise.all([publicPromise, privatePromise]);

    const merged = [
      ...(publicData.data || []).map((r) => ({ ...r, isOwn: user ? r.user_id === user.id : false })),
      ...(privateData.data || []).map((r) => ({ ...r, isOwn: true })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    setRecipes(merged);

    const uniqueAuthorIds = [...new Set(merged.map((r) => r.user_id))];
    await fetchProfiles(uniqueAuthorIds);

    setLoading(false);
  }, []);

  const getAuthor = useCallback(
    (recipe) => {
      if (currentUser && recipe.user_id === currentUser.id) {
        return { name: "You", avatar: currentUserAvatar };
      }
      const profile = profilesMap[recipe.user_id];
      return {
        name: profile?.username || "Anonymous",
        avatar: profile?.avatar_url || null,
      };
    },
    [currentUser, currentUserAvatar, profilesMap]
  );

  // Categories and saved-recipe state are per-user concepts, so these
  // stay no-ops for anonymous visitors.
  const fetchCategories = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.from("categories").select("*").eq("user_id", user.id);
    if (error) {
      console.log(error);
      return;
    }
    const map = {};
    data.forEach((c) => {
      map[c.name] = c.color;
    });
    setCategoriesMap(map);
  }, []);

  const fetchSavedIds = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("saved_recipes").select("recipe_id").eq("user_id", user.id);
    if (data) setSavedRecipeIds(new Set(data.map((r) => r.recipe_id)));
  }, []);

  const showToast = (message) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMessage(message);
    setToastVisible(true);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2000);
  };

  const toggleSave = async (recipeId) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setShowAppModal(true);
      return;
    }
    const isSaved = savedRecipeIds.has(recipeId);

    if (isSaved) {
      await supabase.from("saved_recipes").delete().eq("user_id", user.id).eq("recipe_id", recipeId);
      setSavedRecipeIds((prev) => {
        const next = new Set(prev);
        next.delete(recipeId);
        return next;
      });
      showToast("Recipe unsaved");
    } else {
      await supabase.from("saved_recipes").insert({ user_id: user.id, recipe_id: recipeId });
      setSavedRecipeIds((prev) => new Set([...prev, recipeId]));
      showToast("Recipe saved!");
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchRecipes(), fetchCategories(), fetchSavedIds()]);
    setRefreshing(false);
  };

  const cycleViewMode = () => {
    setViewMode((prev) => {
      const next = prev === "card" ? "list" : prev === "list" ? "grid" : "card";
      localStorage.setItem("viewMode", next);
      return next;
    });
  };

  useEffect(() => {
    const hasSeenPrompt = localStorage.getItem("hasSeenAppPrompt");
    if (!hasSeenPrompt) {
      const timer = setTimeout(() => {
        setShowWelcomeModal(true);
        localStorage.setItem("hasSeenAppPrompt", "true");
      }, 1200); // small delay so it doesn't slam the user the instant the page paints
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    fetchRecipes();
    fetchCategories();
    fetchSavedIds();
  }, [fetchRecipes, fetchCategories, fetchSavedIds]);

  const viewModeIcon =
    viewMode === "card" ? (
      <IoAlbumsOutline size={22} color="#8C6A4A" />
    ) : viewMode === "list" ? (
      <IoListOutline size={22} color="#8C6A4A" />
    ) : (
      <IoGridOutline size={22} color="#8C6A4A" />
    );

  return (
    <div className="home-page">
      <div className="home-page__inner">
        <header className="home-page__header">
          <div>
            <p className="home-page__subtitle">What's cooking?</p>
            <h1 className="home-page__title">Recipease</h1>
          </div>

          <div className="home-page__actions">
            <button
              className="home-page__icon-btn"
              onClick={handleRefresh}
              aria-label="Refresh recipes"
              disabled={refreshing}
            >
              <IoRefreshOutline size={22} color="#8C6A4A" className={refreshing ? "home-page__icon-spin" : ""} />
            </button>
            <button className="home-page__icon-btn" onClick={cycleViewMode} aria-label="Change view mode">
              {viewModeIcon}
            </button>
            <button className="home-page__icon-btn" onClick={() => navigate("/search")} aria-label="Search">
              <IoSearchOutline size={22} color="#8C6A4A" />
            </button>
          </div>
        </header>

        {loading ? (
          <div className="home-page__empty">
            <div className="home-page__spinner" />
          </div>
        ) : recipes.length === 0 ? (
          <div className="home-page__empty">
            <img src="/cracked-bowl-no-bkg.png" alt="" className="home-page__empty-image" />
            <h2 className="home-page__empty-title">No recipes yet</h2>
            <p className="home-page__empty-subtitle">
              Start adding your own recipes and build your collection!
            </p>
            <button className="home-page__empty-btn" onClick={() => navigate("/addrecipes")}>
              Add your first recipe
            </button>
          </div>
        ) : (
          <div className={`home-page__recipes home-page__recipes--${viewMode}`}>
            {recipes.map((item) => (
              <RecipeCard
                key={item.id}
                item={item}
                viewMode={viewMode}
                categoriesMap={categoriesMap}
                getAuthor={getAuthor}
                isSaved={savedRecipeIds.has(item.id)}
                onToggleSave={() => toggleSave(item.id)}
                onPress={() => navigate(`/recipe/${item.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <p className="home-page__footer-text">Enjoy the full experiece with the
        {' '}
        <a
          href="https://apps.apple.com/app/recipease-save-plan-cook/id6763539720"
          className="app-footer__store-btn"
          target="_blank"
          rel="noopener noreferrer"
        >
          Recipease App
        </a>
      </p> 

      <Toast visible={toastVisible} message={toastMessage} />

      <button
        className="home-page__fab"
        onClick={() => setShowAppModal(true)}
        aria-label="Add recipe"
      >
        +
      </button>

      {showAppModal && (
        <div className="app-modal-overlay" onClick={() => setShowAppModal(false)}>
          <div className="app-modal" onClick={(e) => e.stopPropagation()}>
            <img src="/logo-no-bkg.png" alt="Recipease" className="app-modal__logo" />
            <h2 className="app-modal__title">Add recipes on the go</h2>
            <p className="app-modal__text">
              Adding and editing recipes is available in the Recipease app!
            </p>
            <p className="app-modal__text">
              Snap photos, use AI autofill, plan your meals and build your collection from your phone.
            </p>
            
            <a
              href="https://apps.apple.com/app/recipease-save-plan-cook/id6763539720"
              className="app-modal__store-btn"
              target="_blank"
              rel="noopener noreferrer"
            >
              Get it on the App Store
            </a>
            <button className="app-modal__dismiss" onClick={() => setShowAppModal(false)}>
              Maybe later
            </button>
          </div>
        </div>
      )}

      {showWelcomeModal && (
        <div className="app-modal-overlay" onClick={() => setShowWelcomeModal(false)}>
          <div className="app-modal" onClick={(e) => e.stopPropagation()}>
            <img src="/logo-no-bkg.png" alt="Recipease" className="app-modal__logo" />
            <h2 className="app-modal__title">Welcome to Recipease</h2>
            <p className="app-modal__text">
              For the full and better experience (adding recipes, AI autofill, meal planning,
              and more...) grab the Recipease app.
            </p>
            <p className="app-modal__text">
              This web version is still great for browsing.
            </p>
            
            <a
              href="https://apps.apple.com/app/recipease-save-plan-cook/id6763539720"
              className="app-modal__store-btn"
              target="_blank"
              rel="noopener noreferrer"
            >
              Get it on the App Store
            </a>
            <button className="app-modal__dismiss" onClick={() => setShowWelcomeModal(false)}>
              Continue browsing
            </button>
          </div>
        </div>
      )}
    </div>
  );
}