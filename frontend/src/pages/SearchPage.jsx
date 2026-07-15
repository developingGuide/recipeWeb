import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { IoSearchOutline, IoCloseCircle, IoChevronBack } from "react-icons/io5";
import { supabase } from "../../lib/supabase";
import RecipeCard from "../components/RecipeCard";
import "./SearchPage.css";

const DEFAULT_CATEGORIES = ["Breakfast", "Lunch", "Dinner"];

export default function SearchPage() {
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const [currentUser, setCurrentUser] = useState(null);
  const [currentUserAvatar, setCurrentUserAvatar] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [categoriesMap, setCategoriesMap] = useState({});
  const [profilesMap, setProfilesMap] = useState({});

  const dynamicCategories = [
    "All",
    ...DEFAULT_CATEGORIES.filter((c) => !categoriesMap[c]),
    ...Object.keys(categoriesMap),
  ];

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const fetchProfiles = async (userIds) => {
    if (!userIds.length) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .in("id", userIds);
    if (error) return;
    const map = {};
    data.forEach((p) => {
      map[p.id] = { username: p.username, avatar_url: p.avatar_url };
    });
    setProfilesMap(map);
  };

  // Same public/private merge logic as HomePage — search works for
  // signed-out visitors too, just scoped to public recipes.
  const fetchData = useCallback(async () => {
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

    const catPromise = user
      ? supabase.from("categories").select("*").eq("user_id", user.id)
      : Promise.resolve({ data: [] });

    const [publicData, privateData, catData] = await Promise.all([
      publicPromise,
      privatePromise,
      catPromise,
    ]);

    const merged = [
      ...(publicData.data || []).map((r) => ({ ...r, isOwn: user ? r.user_id === user.id : false })),
      ...(privateData.data || []).map((r) => ({ ...r, isOwn: true })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    setRecipes(merged);

    const map = {};
    (catData.data || []).forEach((c) => {
      map[c.name] = c.color;
    });
    setCategoriesMap(map);

    const uniqueAuthorIds = [...new Set(merged.map((r) => r.user_id))];
    await fetchProfiles(uniqueAuthorIds);

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getAuthor = (recipe) => {
    if (currentUser && recipe.user_id === currentUser.id) {
      return { name: "You", avatar: currentUserAvatar };
    }
    const profile = profilesMap[recipe.user_id];
    return {
      name: profile?.username || "Anonymous",
      avatar: profile?.avatar_url || null,
    };
  };

  // Matches title, description, category, AND ingredient names —
  // the ingredient check is the main addition over the category-only filter.
  const filteredRecipes = recipes.filter((recipe) => {
    const matchesCategory =
      selectedCategory === "All" || recipe.categories?.includes(selectedCategory);

    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      recipe.title?.toLowerCase().includes(q) ||
      recipe.description?.toLowerCase().includes(q) ||
      recipe.categories?.some((c) => c.toLowerCase().includes(q)) ||
      recipe.ingredients?.some((ing) => ing.name?.toLowerCase().includes(q));

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="search-page">
      <div className="search-page__inner">
        <div className="search-page__header">
          <button className="search-page__back" onClick={() => navigate(-1)} aria-label="Go back">
            <IoChevronBack size={20} color="#5C3D1E" />
          </button>

          <div className="search-page__bar">
            <IoSearchOutline size={18} color="#8C6A4A" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search recipes, ingredients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-page__input"
            />
            {searchQuery.length > 0 && (
              <button
                className="search-page__clear"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
              >
                <IoCloseCircle size={17} color="#C4A882" />
              </button>
            )}
          </div>
        </div>

        <div className="search-page__categories">
          {dynamicCategories.map((cat) => (
            <button
              key={cat}
              className={`search-page__pill ${selectedCategory === cat ? "search-page__pill--active" : ""}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="search-page__empty">
            <div className="search-page__spinner" />
          </div>
        ) : filteredRecipes.length === 0 ? (
          <div className="search-page__empty">
            <IoSearchOutline size={44} color="#C4A882" />
            <h2 className="search-page__empty-title">No results found</h2>
            <p className="search-page__empty-subtitle">Try a different keyword or category</p>
          </div>
        ) : (
          <div className="search-page__results">
            {filteredRecipes.map((item) => (
              <RecipeCard
                key={item.id}
                item={item}
                viewMode="list"
                categoriesMap={categoriesMap}
                getAuthor={getAuthor}
                isSaved={false}
                onToggleSave={() => {}}
                onPress={() => navigate(`/recipe/${item.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}