CREATE TABLE auditlog (
	id INTEGER NOT NULL, 
	user_email VARCHAR NOT NULL, 
	user_role VARCHAR NOT NULL, 
	shift VARCHAR, 
	action VARCHAR NOT NULL, 
	machine_id VARCHAR, 
	category_id VARCHAR, 
	before_value VARCHAR, 
	after_value VARCHAR, 
	details VARCHAR, 
	timestamp DATETIME NOT NULL, 
	PRIMARY KEY (id)
);
CREATE TABLE oeemetric (
	id INTEGER NOT NULL, 
	report_id INTEGER NOT NULL, 
	operator VARCHAR, 
	machine VARCHAR, 
	part_number VARCHAR, 
	shift VARCHAR, 
	date DATE NOT NULL, 
	availability FLOAT, 
	performance FLOAT, 
	quality FLOAT, 
	oee FLOAT, 
	confidence VARCHAR, 
	diagnostics_json VARCHAR, job VARCHAR, 
	PRIMARY KEY (id), 
	FOREIGN KEY(report_id) REFERENCES productionreport (id)
);
CREATE TABLE productionreport (
	id INTEGER NOT NULL, 
	filename VARCHAR NOT NULL, 
	uploaded_by INTEGER NOT NULL, 
	uploaded_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(uploaded_by) REFERENCES user (id)
);
CREATE TABLE rateaudit (
	id INTEGER NOT NULL, 
	rate_entry_id INTEGER NOT NULL, 
	changed_by INTEGER NOT NULL, 
	changed_at DATETIME NOT NULL, 
	field_name VARCHAR NOT NULL, 
	old_value VARCHAR, 
	new_value VARCHAR, 
	PRIMARY KEY (id), 
	FOREIGN KEY(rate_entry_id) REFERENCES rateentry (id), 
	FOREIGN KEY(changed_by) REFERENCES user (id)
);
CREATE TABLE rateentry (
	id INTEGER NOT NULL, 
	operator VARCHAR, 
	machine VARCHAR, 
	part_number VARCHAR, 
	job VARCHAR, 
	ideal_units_per_hour FLOAT NOT NULL, 
	ideal_cycle_time_seconds FLOAT, 
	start_date DATE NOT NULL, 
	end_date DATE, 
	active BOOLEAN NOT NULL, 
	notes VARCHAR, 
	created_by INTEGER, 
	created_at DATETIME NOT NULL, 
	updated_by INTEGER, 
	updated_at DATETIME NOT NULL, cavity_count INTEGER DEFAULT 1, entry_mode VARCHAR DEFAULT 'seconds', machine_cycle_time FLOAT, run_mode_id INTEGER DEFAULT 1 REFERENCES runmode(id), 
	PRIMARY KEY (id), 
	FOREIGN KEY(created_by) REFERENCES user (id), 
	FOREIGN KEY(updated_by) REFERENCES user (id)
);
CREATE TABLE reportentry (
	id INTEGER NOT NULL, 
	report_id INTEGER NOT NULL, 
	date DATE NOT NULL, 
	operator VARCHAR, 
	machine VARCHAR, 
	part_number VARCHAR, 
	job VARCHAR, 
	planned_production_time_min FLOAT, 
	run_time_min FLOAT, 
	downtime_min FLOAT, 
	total_count INTEGER, 
	good_count INTEGER, 
	reject_count INTEGER, 
	shift VARCHAR, 
	raw_row_json VARCHAR, downtime_events TEXT, run_mode_id INTEGER DEFAULT 1 REFERENCES runmode(id), 
	PRIMARY KEY (id), 
	FOREIGN KEY(report_id) REFERENCES productionreport (id)
);
CREATE TABLE runmode (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR NOT NULL UNIQUE,
                    description VARCHAR,
                    active BOOLEAN DEFAULT 1
                );
CREATE TABLE setting (
	"key" VARCHAR NOT NULL, 
	value VARCHAR NOT NULL, 
	description VARCHAR, 
	PRIMARY KEY ("key")
);
CREATE TABLE user (
	id INTEGER NOT NULL, 
	email VARCHAR NOT NULL, 
	hashed_password VARCHAR NOT NULL, 
	role VARCHAR NOT NULL, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, is_pro BOOLEAN DEFAULT 0, shift_scope VARCHAR, 
	PRIMARY KEY (id)
);
CREATE INDEX ix_rateentry_part_number ON rateentry (part_number);
CREATE INDEX ix_rateentry_operator ON rateentry (operator);
CREATE INDEX ix_rateentry_job ON rateentry (job);
CREATE INDEX ix_rateentry_machine ON rateentry (machine);
CREATE INDEX ix_auditlog_user_email ON auditlog (user_email);
