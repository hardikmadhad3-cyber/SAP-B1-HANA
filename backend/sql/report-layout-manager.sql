IF OBJECT_ID(N'dbo.ReportLayoutMenuEntries', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ReportLayoutMenuEntries (
    MenuEntryID INT IDENTITY(1,1) PRIMARY KEY,
    MenuCode NVARCHAR(100) NOT NULL UNIQUE,
    MenuName NVARCHAR(150) NOT NULL,
    MenuCategory NVARCHAR(100) NOT NULL,
    MenuSequence INT NULL,
    ReportCode NVARCHAR(100) NOT NULL,
    EntryType NVARCHAR(30) NOT NULL CONSTRAINT DF_ReportLayoutMenuEntries_EntryType DEFAULT ('Report'),
    SearchKeywords NVARCHAR(250) NULL,
    IsSystem BIT NOT NULL CONSTRAINT DF_ReportLayoutMenuEntries_IsSystem DEFAULT (0),
    CreatedBy NVARCHAR(120) NOT NULL,
    CreatedDate DATETIME2 NOT NULL CONSTRAINT DF_ReportLayoutMenuEntries_CreatedDate DEFAULT (SYSUTCDATETIME()),
    UpdatedBy NVARCHAR(120) NULL,
    UpdatedDate DATETIME2 NULL
  );

  CREATE INDEX IX_ReportLayoutMenuEntries_Category
    ON dbo.ReportLayoutMenuEntries (MenuCategory, MenuName, ReportCode);
END;
GO

IF COL_LENGTH(N'dbo.ReportLayoutMenuEntries', N'MenuSequence') IS NULL
BEGIN
  ALTER TABLE dbo.ReportLayoutMenuEntries ADD MenuSequence INT NULL;
END;
GO

IF OBJECT_ID(N'dbo.ReportLayouts', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ReportLayouts (
    LayoutID INT IDENTITY(1,1) PRIMARY KEY,
    MenuEntryID INT NULL,
    LayoutName NVARCHAR(150) NOT NULL,
    ReportCode NVARCHAR(100) NOT NULL,
    LayoutJSON NVARCHAR(MAX) NOT NULL,
    IsDefault BIT NOT NULL CONSTRAINT DF_ReportLayouts_IsDefault DEFAULT (0),
    CreatedBy NVARCHAR(120) NOT NULL,
    CreatedDate DATETIME2 NOT NULL CONSTRAINT DF_ReportLayouts_CreatedDate DEFAULT (SYSUTCDATETIME()),
    UpdatedBy NVARCHAR(120) NULL,
    UpdatedDate DATETIME2 NULL,
    AssignedUserId INT NULL,
    AssignedRoleId INT NULL
  );
END;
GO

IF COL_LENGTH(N'dbo.ReportLayouts', N'MenuEntryID') IS NULL
BEGIN
  ALTER TABLE dbo.ReportLayouts ADD MenuEntryID INT NULL;
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = N'IX_ReportLayouts_MenuEntry'
    AND object_id = OBJECT_ID(N'dbo.ReportLayouts')
)
BEGIN
  CREATE INDEX IX_ReportLayouts_MenuEntry
    ON dbo.ReportLayouts (MenuEntryID, ReportCode, IsDefault DESC, LayoutName ASC);
END;
GO

IF OBJECT_ID(N'dbo.ReportLayoutVersions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ReportLayoutVersions (
    VersionID INT IDENTITY(1,1) PRIMARY KEY,
    LayoutID INT NOT NULL,
    VersionNo INT NOT NULL,
    LayoutJSON NVARCHAR(MAX) NOT NULL,
    ChangeNote NVARCHAR(250) NULL,
    ChangedBy NVARCHAR(120) NOT NULL,
    ChangedDate DATETIME2 NOT NULL CONSTRAINT DF_ReportLayoutVersions_ChangedDate DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_ReportLayoutVersions_ReportLayouts
      FOREIGN KEY (LayoutID) REFERENCES dbo.ReportLayouts(LayoutID)
  );

  CREATE INDEX IX_ReportLayoutVersions_LayoutID
    ON dbo.ReportLayoutVersions (LayoutID, VersionNo DESC);
END;
GO

PRINT 'Run the application once after this script. It will seed standard SAP B1-style menu entries and sample layouts automatically.';
