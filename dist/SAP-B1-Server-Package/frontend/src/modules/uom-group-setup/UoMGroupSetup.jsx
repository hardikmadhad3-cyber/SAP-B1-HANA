import React, { useState, useCallback, useEffect } from "react";
import "./styles/uomGroupSetup.css";
import UoMGroupsGrid from "./components/UoMGroupsGrid";
import GroupDefinitionModal from "./components/GroupDefinitionModal";
import {
  createUoMGroup,
  getUoMGroup,
  updateUoMGroup,
  searchUoMGroups,
  fetchUoMs,
} from "../../api/uomGroupApi";

export default function UoMGroupSetup() {
  const [groups, setGroups] = useState([]);
  const [uomOptions, setUomOptions] = useState([]);
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showDefinitionModal, setShowDefinitionModal] = useState(false);

  // Load UoMs for dropdowns
  useEffect(() => {
    loadUoMs();
    loadGroups();
  }, []);

  const loadUoMs = async () => {
    try {
      const data = await fetchUoMs();
      setUomOptions(data);
    } catch (err) {
      console.error("Failed to load UoMs:", err);
    }
  };

  const loadGroups = async () => {
    try {
      const data = await searchUoMGroups("");
      setGroups(data);
    } catch (err) {
      console.error("Failed to load groups:", err);
    }
  };

  const showAlert = (type, msg) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Save all groups
      for (const group of groups) {
        if (!group.Code || !group.Name || !group.BaseUoM) {
          showAlert("error", "Code, Name and Base UoM are required for all groups.");
          setLoading(false);
          return;
        }

        if (group.isNew) {
          await createUoMGroup({
            Code: group.Code,
            Name: group.Name,
            BaseUoM: parseInt(group.BaseUoM),
          });
        } else if (group.isModified) {
          await updateUoMGroup(group.AbsEntry, {
            Name: group.Name,
            BaseUoM: parseInt(group.BaseUoM),
          });
        }
      }
      showAlert("success", "UoM Groups saved successfully.");
      await loadGroups();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Failed to save groups.";
      showAlert("error", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    loadGroups();
    setAlert(null);
  };

  const handleOpenDefinition = (group) => {
    setSelectedGroup(group);
    setShowDefinitionModal(true);
  };

  const handleCloseDefinition = () => {
    setShowDefinitionModal(false);
    setSelectedGroup(null);
  };

  return (
    <div className="uom-page">
      {/* Toolbar */}
      <div className="uom-toolbar">
        <span className="uom-toolbar__title">Unit of Measurement Groups - Setup</span>
        <button className="uom-btn uom-btn--primary" onClick={handleSave} disabled={loading}>
          {loading ? "..." : "OK"}
        </button>
        <button className="uom-btn" onClick={handleCancel}>
          Cancel
        </button>
      </div>

      {alert && <div className={`uom-alert uom-alert--${alert.type}`}>{alert.msg}</div>}

      {/* Groups Grid */}
      <UoMGroupsGrid
        groups={groups}
        setGroups={setGroups}
        uomOptions={uomOptions}
        onOpenDefinition={handleOpenDefinition}
      />

      {/* Group Definition Modal */}
      {showDefinitionModal && selectedGroup && (
        <GroupDefinitionModal
          group={selectedGroup}
          uomOptions={uomOptions}
          onClose={handleCloseDefinition}
          onSave={loadGroups}
        />
      )}
    </div>
  );
}
