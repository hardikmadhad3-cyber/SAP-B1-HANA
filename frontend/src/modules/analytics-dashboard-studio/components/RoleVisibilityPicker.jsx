import React, { useEffect, useState } from 'react';
import { fetchAnalyticsRoles } from '../../../api/analyticsDashboardApi';

const RoleVisibilityPicker = ({ selectedRoleIds, onChange }) => {
  const [roles, setRoles] = useState([]);

  useEffect(() => {
    fetchAnalyticsRoles().then(setRoles).catch(() => setRoles([]));
  }, []);

  const toggleRole = (roleId) => {
    const next = selectedRoleIds.includes(roleId)
      ? selectedRoleIds.filter((id) => id !== roleId)
      : [...selectedRoleIds, roleId];
    onChange(next);
  };

  if (!roles.length) {
    return <p className="ads-field-mapping__empty">No roles available.</p>;
  }

  return (
    <div className="ads-role-picker">
      {roles.map((role) => (
        <label key={role.roleId} className="ads-role-picker__item">
          <input
            type="checkbox"
            checked={selectedRoleIds.includes(role.roleId)}
            onChange={() => toggleRole(role.roleId)}
          />
          {role.roleName}
        </label>
      ))}
    </div>
  );
};

export default RoleVisibilityPicker;
