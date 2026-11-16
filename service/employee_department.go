package service

// deptSimplified 是写库时部门字段的简化结构。
type deptSimplified struct {
	DepartmentId        string             `json:"department_id"`
	DepartmentPathInfos []deptPathSimple   `json:"department_path_infos"`
	Leaders             []deptLeaderSimple `json:"leaders"`
	Name                string             `json:"name"`
}

type deptPathSimple struct {
	DepartmentId   string `json:"department_id"`
	DepartmentName string `json:"department_name"`
}

type deptLeaderSimple struct {
	LeaderId string `json:"leader_id"`
}
