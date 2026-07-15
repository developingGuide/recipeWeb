import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  IoChevronBackOutline,
  IoEllipsisVertical,
  IoBulbOutline,
  IoPlay,
  IoPause,
  IoRefresh,
} from "react-icons/io5";
import { supabase } from "../../lib/supabase";
import "./RecipeDetailsPage.css";

export default function RecipeDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [menuVisible, setMenuVisible] = useState(false);

  const [activeTimers, setActiveTimers] = useState({});
  const [pausedTimers, setPausedTimers] = useState({});
  const timerIntervals = useRef({});

  const totalTime = (Number(recipe?.prep_time) || 0) + (Number(recipe?.cook_time) || 0);

  // Public recipes are viewable by anyone with the link — auth is only
  // needed to know whether to show the edit/delete menu.
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

  useEffect(() => {
    fetchRecipe();
  }, [id]);

  useEffect(() => {
    return () => {
      Object.values(timerIntervals.current).forEach(clearInterval);
    };
  }, []);

  if (loading) {
    return (
      <div className="recipe-details__center">
        <div className="recipe-details__spinner" />
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="recipe-details__center">
        <p>Recipe not found</p>
      </div>
    );
  }

  const isOwner = recipe.user_id === currentUser?.id;

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

      {/* CONTENT — scrolls normally on web, no drag gesture needed */}
      <div className="recipe-details__content">
       <div className="recipe-details__content-inner">
        {recipe.categories?.map((cat, i) => (
          <span key={i} className="recipe-details__category">
            {cat}
          </span>
        ))}

        <h1 className="recipe-details__title">{recipe.title}</h1>
        {recipe.description && <p className="recipe-details__description">{recipe.description}</p>}

        {(totalTime > 0 || recipe.servings) && (
          <div className="recipe-details__stats-row">
            {totalTime > 0 && (
              <div className="recipe-details__stat">
                <span className="recipe-details__stat-value">{totalTime} min</span>
                <span className="recipe-details__stat-label">Total Time</span>
              </div>
            )}
            {recipe.servings && (
              <div className="recipe-details__stat">
                <span className="recipe-details__stat-value">{recipe.servings}</span>
                <span className="recipe-details__stat-label">Servings</span>
              </div>
            )}
          </div>
        )}

        <h2 className="recipe-details__section-title">Ingredients</h2>
        {recipe.ingredients.map((item, index) => (
          <div key={index} className="recipe-details__ingredient-row">
            <span className="recipe-details__bullet">•</span>
            <span className="recipe-details__ingredient-text">
              <strong>{item.qty}</strong>
              {item.unit ? ` ${item.unit}` : ""}
              {item.name ? ` ${item.name}` : ""}
            </span>
          </div>
        ))}

        <h2 className="recipe-details__section-title">Instructions</h2>
        {recipe.steps.map((step, index) => {
          const totalSeconds = step.timer ? step.timer * 60 : null;
          const remaining = activeTimers[index];
          const isActive = !pausedTimers[index] && timerIntervals.current[index] != null;
          const isInitialised = remaining != null;

          const display = isInitialised
            ? `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`
            : `${step.timer} min`;

          return (
            <div key={index} className="recipe-details__step">
              <div className="recipe-details__step-number">{index + 1}</div>

              <div className="recipe-details__step-body">
                <p className="recipe-details__step-text">{step.description}</p>

                {step.tip && (
                  <p className="recipe-details__tip">
                    <IoBulbOutline size={14} color="#4CAF50" style={{ verticalAlign: "-2px" }} /> {step.tip}
                  </p>
                )}

                {totalSeconds && (
                  <div className="recipe-details__timer-chip">
                    <span className="recipe-details__timer-text">⏱ {display}</span>
                    <div className="recipe-details__timer-controls">
                      <button
                        className="recipe-details__timer-btn"
                        onClick={() =>
                          isActive ? pauseTimer(index) : startTimer(index, isInitialised ? remaining : totalSeconds)
                        }
                        aria-label={isActive ? "Pause timer" : "Start timer"}
                      >
                        {isActive ? <IoPause size={14} color="#fff" /> : <IoPlay size={14} color="#fff" />}
                      </button>
                      {isInitialised && (
                        <button
                          className="recipe-details__timer-btn recipe-details__timer-btn--reset"
                          onClick={() => resetTimer(index)}
                          aria-label="Reset timer"
                        >
                          <IoRefresh size={14} color="#5C3D1E" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <button className="recipe-details__start-btn" onClick={() => navigate(`/cook/${id}`)}>
          Start Cooking
        </button>
       </div>
      </div>
    </div>
  );
}