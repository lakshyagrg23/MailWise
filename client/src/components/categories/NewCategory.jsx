import React from "react";
import { Box, Typography } from "@mui/material";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import { useCategoryManager } from "./useCategoryManager";
import NewCategoryForm from "./NewCategoryForm";
import CategoryListItem from "./CategoryListItem";

const NewCategory = () => {
  const { error, busy, userCategories, emailCount, form, row } = useCategoryManager();

  return (
    <Box sx={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Title */}
      <Box sx={{ mb: 2.5, pr: 4 }}>
        <Typography sx={{ fontSize: "20px", fontWeight: 700, color: "#0f172a", letterSpacing: "-0.2px" }}>
          Categories
        </Typography>
        <Typography sx={{ fontSize: "13.5px", color: "#64748b", mt: 0.5, lineHeight: 1.5 }}>
          Gemini sorts each new email into the category whose description fits best. Clear,
          specific descriptions work best.
        </Typography>
      </Box>

      {error && (
        <Box
          role="alert"
          sx={{ mb: 2, px: 1.75, py: 1.1, borderRadius: 2, fontSize: "13px", color: "#b91c1c", backgroundColor: "#fef2f2", border: "1px solid #fecaca" }}
        >
          {error}
        </Box>
      )}

      <NewCategoryForm form={form} />

      {/* List */}
      <Typography sx={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.6, mb: 1 }}>
        Your categories{userCategories.length ? ` · ${userCategories.length}` : ""}
      </Typography>

      <Box sx={{ maxHeight: { xs: "40vh", sm: "320px" }, overflowY: "auto", pr: 0.5, scrollbarWidth: "thin" }}>
        {userCategories.length > 0 ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
            {userCategories.map((category) => (
              <CategoryListItem
                key={category.name}
                category={category}
                count={emailCount(category.name)}
                row={row}
                busy={busy}
              />
            ))}
          </Box>
        ) : (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <LabelOutlinedIcon sx={{ fontSize: 34, color: "#cbd5e1", mb: 0.5 }} />
            <Typography sx={{ fontSize: "14px", fontWeight: 600, color: "#475569" }}>No custom categories yet</Typography>
            <Typography sx={{ fontSize: "13px", color: "#94a3b8", mt: 0.25 }}>
              Create one above and new mail will start sorting into it.
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default NewCategory;
