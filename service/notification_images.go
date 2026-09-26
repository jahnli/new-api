package service

import (
	"fmt"
	"slices"
	"strings"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/text"
)

const notificationImagePrefix = "cid:notification-image-"

type notificationImageReference struct {
	ID         string
	Alt        string
	Start, End int
}

// Preserve the original Markdown around images; parsing prevents examples in
// code fences or escaped image syntax from becoming attachment placements.
type notificationImageParser struct{ parser.InlineParser }

func (p notificationImageParser) Parse(parent ast.Node, reader text.Reader, context parser.Context) ast.Node {
	node := p.InlineParser.Parse(parent, reader, context)
	if image, ok := node.(*ast.Image); ok {
		_, segment := reader.Position()
		image.SetAttributeString("notification-end", segment.Start)
	}
	return node
}

func (p notificationImageParser) CloseBlock(parent ast.Node, reader text.Reader, context parser.Context) {
	if closer, ok := p.InlineParser.(parser.CloseBlocker); ok {
		closer.CloseBlock(parent, reader, context)
	}
}

func notificationImageReferences(message NotificationMessage) ([]notificationImageReference, error) {
	inlineParsers := parser.DefaultInlineParsers()
	for i := range inlineParsers {
		if inlineParsers[i].Value == parser.NewLinkParser() {
			inlineParsers[i].Value = notificationImageParser{InlineParser: parser.NewLinkParser()}
		}
	}
	markdown := goldmark.New(goldmark.WithParser(parser.NewParser(
		parser.WithBlockParsers(parser.DefaultBlockParsers()...),
		parser.WithInlineParsers(inlineParsers...),
		parser.WithParagraphTransformers(parser.DefaultParagraphTransformers()...),
	)), goldmark.WithExtensions(extension.GFM))
	source := []byte(message.Content)
	document := markdown.Parser().Parse(text.NewReader(source))
	references := make([]notificationImageReference, 0)
	err := ast.Walk(document, func(node ast.Node, entering bool) (ast.WalkStatus, error) {
		if !entering {
			return ast.WalkContinue, nil
		}
		image, ok := node.(*ast.Image)
		if !ok {
			return ast.WalkContinue, nil
		}
		id, local := strings.CutPrefix(string(image.Destination), notificationImagePrefix)
		if !local {
			return ast.WalkContinue, nil
		}
		if !slices.ContainsFunc(message.Images, func(attachment NotificationImage) bool { return attachment.ID != "" && attachment.ID == id }) {
			return ast.WalkStop, fmt.Errorf("正文中的图片引用不存在，请重新插入图片")
		}
		value, exists := image.AttributeString("notification-end")
		end, valid := value.(int)
		if !exists || !valid || image.Pos() < 0 || end <= image.Pos() || end > len(source) {
			return ast.WalkStop, fmt.Errorf("无法解析正文图片位置")
		}
		if len(references) > 0 && image.Pos() < references[len(references)-1].End {
			return ast.WalkStop, fmt.Errorf("正文图片位置重叠，请将图片分别插入正文")
		}
		references = append(references, notificationImageReference{ID: id, Alt: string(image.Text(source)), Start: image.Pos(), End: end})
		return ast.WalkSkipChildren, nil
	})
	return references, err
}
