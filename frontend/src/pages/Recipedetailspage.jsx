import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  IoChevronBackOutline,
  IoEllipsisVertical,
  IoPlay,
  IoPause,
  IoRefresh,
  IoCheckbox,
  IoSquareOutline,
  IoCheckmark,
  IoTimerOutline,
} from "react-icons/io5";
import { supabase } from "../../lib/supabase";
import "./RecipeDetailsPage.css";
import PanLoader from "../components/PanLoader";

const MACRO_COLORS = {
  time: { bg: "#F2F2F2", text: "#5C3D1E", label: "#8C6A4A" },
  servings: { bg: "#F2F2F2", text: "#5C3D1E", label: "#8C6A4A" },
  calories: { bg: "#F1EFEC", text: "#5C3D1E", label: "#8C6A4A" },
  protein: { bg: "#FBE4E4", text: "#B5484D", label: "#C97A7D" },
  carbs: { bg: "#FBF3D9", text: "#A9822C", label: "#C4A863" },
  fat: { bg: "#E9E4F7", text: "#7A66B0", label: "#A395C9" },
};

const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildIngredientMatcher = (ingredients) => {
  if (!ingredients?.length) return null;
  const names = ingredients
    .map((i) => i.name?.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (!names.length) return null;
  const pattern = names.map(escapeRegExp).join("|");
  return new RegExp(`\\b(${pattern})\\b`, "gi");
};

const renderStepWithBoldedIngredients = (text, matcher) => {
  if (!matcher || !text) return text;
  const parts = text.split(matcher);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : part
  );
};

export default function RecipeDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [menuVisible, setMenuVisible] = useState(false);

  const [activeTimers, setActiveTimers] = useState({});
  const [pausedTimers, setPausedTimers] = useState({});

  const [checkedIngredients, setCheckedIngredients] = useState({});
  const [completedSteps, setCompletedSteps] = useState({});

  const [showAppModal, setShowAppModal] = useState(false);

  const timerIntervals = useRef({});

  const totalTime = (Number(recipe?.prep_time) || 0) + (Number(recipe?.cook_time) || 0);

  const fetchRecipe = async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    setCurrentUser(user || null);

    const { data, error } = await supabase.from("recipes").select("*").eq("id", id).single();

    if (error) {
      console.log(error);
    } else {
      setRecipe(data);
    }

    setLoading(false);
  };

  const handleDelete = async () => {
    const confirmed = window.confirm("Are you sure you want to delete this recipe?");
    if (!confirmed) return;

    const { error } = await supabase.from("recipes").delete().eq("id", id);

    if (error) {
      console.log(error);
      alert("Error deleting recipe");
    } else {
      navigate("/");
    }
  };

  const startTimer = (index, totalSeconds) => {
    if (timerIntervals.current[index]) return;

    setPausedTimers((prev) => ({ ...prev, [index]: false }));

    setActiveTimers((prev) => {
      if (prev[index] == null) {
        return { ...prev, [index]: totalSeconds };
      }
      return prev;
    });

    timerIntervals.current[index] = setInterval(() => {
      setActiveTimers((prev) => {
        const remaining = (prev[index] ?? totalSeconds) - 1;

        if (remaining <= 0) {
          clearInterval(timerIntervals.current[index]);
          delete timerIntervals.current[index];
          setPausedTimers((p) => ({ ...p, [index]: false }));
          return { ...prev, [index]: 0 };
        }

        return { ...prev, [index]: remaining };
      });
    }, 1000);
  };

  const pauseTimer = (index) => {
    clearInterval(timerIntervals.current[index]);
    delete timerIntervals.current[index];
    setPausedTimers((prev) => ({ ...prev, [index]: true }));
  };

  const resetTimer = (index) => {
    pauseTimer(index);
    setActiveTimers((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const toggleIngredient = (index) => {
    setCheckedIngredients((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const clearCheckedIngredients = () => setCheckedIngredients({});

  const toggleStep = (index) => {
    setCompletedSteps((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const clearCompletedSteps = () => setCompletedSteps({});

  const getIngredientAmount = (item) => {
    if (item.amount) return item.amount;
    return [item.qty, item.unit].filter(Boolean).join(" ");
  };

  useEffect(() => {
    fetchRecipe();
  }, [id]);

  useEffect(() => {
    return () => {
      Object.values(timerIntervals.current).forEach(clearInterval);
    };
  }, []);

  // Load saved checklist state whenever the recipe changes
  useEffect(() => {
    if (!recipe) return;
    try {
      const savedIngredients = localStorage.getItem(`recipe:${id}:checkedIngredients`);
      const savedSteps = localStorage.getItem(`recipe:${id}:completedSteps`);
      setCheckedIngredients(savedIngredients ? JSON.parse(savedIngredients) : {});
      setCompletedSteps(savedSteps ? JSON.parse(savedSteps) : {});
    } catch (e) {
      console.log("Error loading checklist state", e);
    }
  }, [recipe?.id]);

  useEffect(() => {
    if (!recipe) return;
    localStorage.setItem(`recipe:${id}:checkedIngredients`, JSON.stringify(checkedIngredients));
  }, [checkedIngredients, recipe?.id]);

  useEffect(() => {
    if (!recipe) return;
    localStorage.setItem(`recipe:${id}:completedSteps`, JSON.stringify(completedSteps));
  }, [completedSteps, recipe?.id]);

  if (loading) {
    return <PanLoader />;
  }

  if (!recipe) {
    return (
      <div className="recipe-details__center">
        <p>Recipe not found</p>
      </div>
    );
  }

  const isOwner = recipe.user_id === currentUser?.id;
  const ingredientMatcher = recipe?.ingredients ? buildIngredientMatcher(recipe.ingredients) : null;
  const completedCount = Object.values(completedSteps).filter(Boolean).length;
  const hasValue = (v) => v !== null && v !== undefined && v !== "" && Number(v) !== 0;

  return (
    <div className="recipe-details">
      {/* MEDIA — image column, sticky on wide screens */}
      <div className="recipe-details__media">
        {recipe.image_url ? (
          <img src={recipe.image_url} alt={recipe.title} className="recipe-details__image" />
        ) : (
          <div className="recipe-details__placeholder">
            <img src="/logo-no-bkg.png" alt="" className="recipe-details__placeholder-logo" />
            <p className="recipe-details__placeholder-text">No Image Available</p>
          </div>
        )}

        <button className="recipe-details__back-btn" onClick={() => navigate(-1)} aria-label="Go back">
          <IoChevronBackOutline size={20} />
        </button>

        {isOwner && (
          <button
            className="recipe-details__menu-btn"
            onClick={() => setMenuVisible((v) => !v)}
            aria-label="Recipe options"
          >
            <IoEllipsisVertical size={20} />
          </button>
        )}

        {menuVisible && (
          <div className="recipe-details__menu">
            <button
              className="recipe-details__menu-item"
              onClick={() => {
                setMenuVisible(false);
                navigate(`/edit/${id}`);
              }}
            >
              Edit
            </button>
            <button className="recipe-details__menu-item recipe-details__menu-item--danger" onClick={handleDelete}>
              Delete
            </button>
          </div>
        )}
      </div>

      {/* CONTENT */}
      <div className="recipe-details__content">
        <div className="recipe-details__content-inner">
          {recipe.categories?.map((cat, i) => (
            <span key={i} className="recipe-details__category">
              {cat}
            </span>
          ))}

          <h1 className="recipe-details__title">{recipe.title}</h1>
          {recipe.description && <p className="recipe-details__description">{recipe.description}</p>}

          {(hasValue(totalTime) ||
            hasValue(recipe.servings) ||
            hasValue(recipe.calories) ||
            hasValue(recipe.protein) ||
            hasValue(recipe.carbs) ||
            hasValue(recipe.fat)) && (
            <div className="recipe-details__stats-row">
              {hasValue(totalTime) && (
                <div className="recipe-details__stat" style={{ background: MACRO_COLORS.time.bg }}>
                  <span className="recipe-details__stat-value" style={{ color: MACRO_COLORS.time.text }}>
                    {totalTime} min
                  </span>
                  <span className="recipe-details__stat-label" style={{ color: MACRO_COLORS.time.label }}>
                    Total Time
                  </span>
                </div>
              )}
              {hasValue(recipe.servings) && (
                <div className="recipe-details__stat" style={{ background: MACRO_COLORS.servings.bg }}>
                  <span className="recipe-details__stat-value" style={{ color: MACRO_COLORS.servings.text }}>
                    {recipe.servings}
                  </span>
                  <span className="recipe-details__stat-label" style={{ color: MACRO_COLORS.servings.label }}>
                    Servings
                  </span>
                </div>
              )}
              {hasValue(recipe.calories) && (
                <div className="recipe-details__stat" style={{ background: MACRO_COLORS.calories.bg }}>
                  <span className="recipe-details__stat-value" style={{ color: MACRO_COLORS.calories.text }}>
                    {recipe.calories}
                  </span>
                  <span className="recipe-details__stat-label" style={{ color: MACRO_COLORS.calories.label }}>
                    Calories
                  </span>
                </div>
              )}
              {hasValue(recipe.protein) && (
                <div className="recipe-details__stat" style={{ background: MACRO_COLORS.protein.bg }}>
                  <span className="recipe-details__stat-value" style={{ color: MACRO_COLORS.protein.text }}>
                    {recipe.protein}g
                  </span>
                  <span className="recipe-details__stat-label" style={{ color: MACRO_COLORS.protein.label }}>
                    Protein
                  </span>
                </div>
              )}
              {hasValue(recipe.carbs) && (
                <div className="recipe-details__stat" style={{ background: MACRO_COLORS.carbs.bg }}>
                  <span className="recipe-details__stat-value" style={{ color: MACRO_COLORS.carbs.text }}>
                    {recipe.carbs}g
                  </span>
                  <span className="recipe-details__stat-label" style={{ color: MACRO_COLORS.carbs.label }}>
                    Carbs
                  </span>
                </div>
              )}
              {hasValue(recipe.fat) && (
                <div className="recipe-details__stat" style={{ background: MACRO_COLORS.fat.bg }}>
                  <span className="recipe-details__stat-value" style={{ color: MACRO_COLORS.fat.text }}>
                    {recipe.fat}g
                  </span>
                  <span className="recipe-details__stat-label" style={{ color: MACRO_COLORS.fat.label }}>
                    Fat
                  </span>
                </div>
              )}
            </div>
          )}

          {/* INGREDIENTS */}
          <div className="recipe-details__section-header-row">
            <h2 className="recipe-details__section-title recipe-details__section-title--flush">Ingredients</h2>
            {Object.values(checkedIngredients).some(Boolean) && (
              <button className="recipe-details__clear-btn" onClick={clearCheckedIngredients}>
                Clear
              </button>
            )}
          </div>

          {recipe.ingredients.map((item, index) => {
            const isChecked = !!checkedIngredients[index];
            const amount = getIngredientAmount(item);
            return (
              <button
                key={index}
                className="recipe-details__ingredient-row"
                onClick={() => toggleIngredient(index)}
                type="button"
              >
                {isChecked ? (
                  <IoCheckbox size={20} color="#4CAF50" className="recipe-details__ingredient-icon" />
                ) : (
                  <IoSquareOutline size={20} color="#E07A5F" className="recipe-details__ingredient-icon" />
                )}
                <span
                  className={
                    "recipe-details__ingredient-text" +
                    (isChecked ? " recipe-details__ingredient-text--checked" : "")
                  }
                >
                  {amount && <strong>{amount} </strong>}
                  {item.name || ""}
                </span>
              </button>
            );
          })}

          {/* INSTRUCTIONS */}
          <div className="recipe-details__instructions-header">
            <div>
              <h2 className="recipe-details__section-title recipe-details__section-title--flush">Steps</h2>
              <p className="recipe-details__instructions-progress">
                {completedCount} of {recipe.steps.length} completed
              </p>
            </div>
            {Object.values(completedSteps).some(Boolean) && (
              <button className="recipe-details__clear-btn" onClick={clearCompletedSteps}>
                Clear
              </button>
            )}
          </div>

          <div className="recipe-details__progress-track">
            <div
              className="recipe-details__progress-fill"
              style={{
                width: `${recipe.steps.length ? (completedCount / recipe.steps.length) * 100 : 0}%`,
              }}
            />
          </div>

          {recipe.steps.map((step, index) => {
            const totalSeconds = step.timer ? step.timer * 60 : null;
            const remaining = activeTimers[index];
            const isActive = !pausedTimers[index] && timerIntervals.current[index] != null;
            const isInitialised = remaining != null;
            const isCompleted = !!completedSteps[index];

            const display = isInitialised
              ? `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`
              : `${step.timer} min`;

            return (
              <div
                key={index}
                className={"recipe-details__step" + (isCompleted ? " recipe-details__step--completed" : "")}
              >
                <button
                  className={
                    "recipe-details__step-number" +
                    (isCompleted ? " recipe-details__step-number--completed" : "")
                  }
                  onClick={() => toggleStep(index)}
                  type="button"
                >
                  {isCompleted ? <IoCheckmark size={15} color="#fff" /> : String(index + 1).padStart(2, "0")}
                </button>

                <div className="recipe-details__step-body">
                  <p
                    className={
                      "recipe-details__step-text" + (isCompleted ? " recipe-details__step-text--done" : "")
                    }
                    onClick={() => toggleStep(index)}
                  >
                    {renderStepWithBoldedIngredients(step.description, ingredientMatcher)}
                  </p>

                  {step.tip && (
                    <div className="recipe-details__tip">
                      <p className="recipe-details__tip-label">✦ Chef's Tip</p>
                      <p className="recipe-details__tip-text">{step.tip}</p>
                    </div>
                  )}

                  {totalSeconds && (
                    <div className="recipe-details__timer-chip">
                      <div className="recipe-details__timer-info">
                        <IoTimerOutline size={18} color="#8C6A4A" />
                        <span className="recipe-details__timer-text">{display}</span>
                      </div>
                      <div className="recipe-details__timer-controls">
                        <button
                          className="recipe-details__timer-play-btn"
                          onClick={() =>
                            isActive ? pauseTimer(index) : startTimer(index, isInitialised ? remaining : totalSeconds)
                          }
                          aria-label={isActive ? "Pause timer" : "Start timer"}
                        >
                          {isActive ? <IoPause size={15} color="#fff" /> : <IoPlay size={15} color="#fff" />}
                        </button>
                        {isInitialised && (
                          <button
                            className="recipe-details__timer-secondary-btn"
                            onClick={() => resetTimer(index)}
                            aria-label="Reset timer"
                          >
                            <IoRefresh size={16} color="#8C6A4A" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <button className="recipe-details__start-btn" onClick={() => setShowAppModal(true)}>
            Start Cooking
          </button>
        </div>
      </div>

      {showAppModal && (
        <div className="app-modal-overlay" onClick={() => setShowAppModal(false)}>
          <div className="app-modal" onClick={(e) => e.stopPropagation()}>
            <img src="/logo-no-bkg.png" alt="Recipease" className="app-modal__logo" />
            <h2 className="app-modal__title">Add recipes on the go</h2>
            <p className="app-modal__text">Adding and editing recipes is available in the Recipease app!</p>
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
    </div>
  );
}