package service

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/extension"
	extast "github.com/yuin/goldmark/extension/ast"
	"github.com/yuin/goldmark/text"
)

type notificationFeishuElement struct {
	Start, End int
	Element    map[string]any
}

// Feishu's Markdown element does not render GFM tables. Parse them with the
// same Markdown grammar used for attachments, leaving fenced examples intact.
func notificationFeishuTables(content string) ([]notificationFeishuElement, error) {
	source := []byte(content)
	document := goldmark.New(goldmark.WithExtensions(extension.GFM)).Parser().Parse(text.NewReader(source))
	tables := make([]notificationFeishuElement, 0)
	err := ast.Walk(document, func(node ast.Node, entering bool) (ast.WalkStatus, error) {
		table, ok := node.(*extast.Table)
		if !entering || !ok {
			return ast.WalkContinue, nil
		}
		if table.Parent() != document {
			return ast.WalkStop, fmt.Errorf("飞书表格请单独成段，不要嵌套在列表或引用中")
		}
		if err := ast.Walk(table, func(child ast.Node, entering bool) (ast.WalkStatus, error) {
			if entering && child.Kind() == ast.KindImage {
				return ast.WalkStop, fmt.Errorf("飞书表格单元格不支持图片，请将图片移到表格外")
			}
			return ast.WalkContinue, nil
		}); err != nil {
			return ast.WalkStop, err
		}
		header := table.FirstChild()
		start := header.Pos()
		end := start
		// Every GFM table row occupies one source line, plus its delimiter line.
		for range table.ChildCount() + 1 {
			newline := strings.IndexByte(content[end:], '\n')
			if newline < 0 {
				end = len(content)
				break
			}
			end += newline + 1
		}
		columns := make([]map[string]any, 0, len(table.Alignments))
		column := 0
		for cell := header.FirstChild(); cell != nil; cell = cell.NextSibling() {
			alignment := table.Alignments[column].String()
			if alignment == "none" {
				alignment = "left"
			}
			columns = append(columns, map[string]any{
				"name": "column_" + strconv.Itoa(column), "display_name": string(cell.Text(source)),
				"data_type": "lark_md", "width": "auto", "horizontal_align": alignment,
			})
			column++
		}
		rows := make([]map[string]string, 0, table.ChildCount()-1)
		for row := header.NextSibling(); row != nil; row = row.NextSibling() {
			values := make(map[string]string, len(columns))
			column = 0
			for cell := row.FirstChild(); cell != nil; cell = cell.NextSibling() {
				value := string(cell.Lines().Value(source))
				values["column_"+strconv.Itoa(column)] = strings.ReplaceAll(value, `\|`, "|")
				column++
			}
			rows = append(rows, values)
		}
		tables = append(tables, notificationFeishuElement{
			Start: start, End: end,
			Element: map[string]any{
				"tag": "table", "page_size": 10, "row_height": "low",
				"header_style": map[string]any{"background_style": "grey", "bold": true},
				"columns":      columns, "rows": rows,
			},
		})
		return ast.WalkSkipChildren, nil
	})
	return tables, err
}
