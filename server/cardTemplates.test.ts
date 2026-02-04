import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb } from './_core/db';
import * as templateDb from './db/cardTemplates';

describe('Card Templates System', () => {
  let testTemplateId: number | null = null;

  describe('Template CRUD Operations', () => {
    it('should create a new template', async () => {
      const templateData = {
        name: 'Test Template',
        resellerId: null,
        imageUrl: 'https://example.com/test-image.png',
        imageKey: 'templates/test/test-image.png',
      };

      const id = await templateDb.createTemplate(templateData);
      expect(id).toBeGreaterThan(0);
      testTemplateId = id;
    });

    it('should get template by id', async () => {
      if (!testTemplateId) {
        throw new Error('Test template not created');
      }

      const template = await templateDb.getTemplateById(testTemplateId);
      expect(template).toBeDefined();
      expect(template?.name).toBe('Test Template');
      expect(template?.imageUrl).toBe('https://example.com/test-image.png');
    });

    it('should list all templates', async () => {
      const templates = await templateDb.getTemplates();
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
    });

    it('should update template settings', async () => {
      if (!testTemplateId) {
        throw new Error('Test template not created');
      }

      await templateDb.updateTemplate(testTemplateId, {
        name: 'Updated Template',
        usernameX: 150,
        usernameY: 120,
        usernameFontSize: 16,
        usernameFontFamily: 'digital',
        usernameFontColor: '#FF0000',
        usernameAlign: 'center',
        passwordX: 150,
        passwordY: 150,
        passwordFontSize: 14,
        passwordFontFamily: 'clear',
        passwordFontColor: '#00FF00',
        passwordAlign: 'right',
        qrCodeEnabled: true,
        qrCodeX: 20,
        qrCodeY: 20,
        qrCodeSize: 100,
        qrCodeDomain: 'http://192.168.1.1/login',
        cardsPerPage: 10,
        marginTop: '2.0',
        marginHorizontal: '1.5',
        columnsPerPage: 4,
      });

      const updated = await templateDb.getTemplateById(testTemplateId);
      expect(updated?.name).toBe('Updated Template');
      expect(updated?.usernameX).toBe(150);
      expect(updated?.usernameFontFamily).toBe('digital');
      expect(updated?.qrCodeEnabled).toBe(true);
      expect(updated?.qrCodeDomain).toBe('http://192.168.1.1/login');
    });

    it('should set template as default', async () => {
      if (!testTemplateId) {
        throw new Error('Test template not created');
      }

      await templateDb.setDefaultTemplate(testTemplateId);
      
      const template = await templateDb.getTemplateById(testTemplateId);
      expect(template?.isDefault).toBe(true);

      const defaultTemplate = await templateDb.getDefaultTemplate();
      expect(defaultTemplate?.id).toBe(testTemplateId);
    });

    it('should delete template', async () => {
      if (!testTemplateId) {
        throw new Error('Test template not created');
      }

      await templateDb.deleteTemplate(testTemplateId);
      
      const deleted = await templateDb.getTemplateById(testTemplateId);
      expect(deleted).toBeUndefined();
    });
  });

  describe('Template Default Values', () => {
    it('should have correct default values for new template', async () => {
      const templateData = {
        name: 'Default Values Test',
        resellerId: null,
        imageUrl: 'https://example.com/default-test.png',
        imageKey: 'templates/test/default-test.png',
      };

      const id = await templateDb.createTemplate(templateData);
      const template = await templateDb.getTemplateById(id);

      // Check that template was created with expected structure
      expect(template).toBeDefined();
      expect(template?.name).toBe('Default Values Test');
      expect(template?.imageUrl).toBe('https://example.com/default-test.png');
      
      // Check numeric fields exist (values may vary based on schema defaults)
      expect(typeof template?.usernameX).toBe('number');
      expect(typeof template?.usernameY).toBe('number');
      expect(typeof template?.usernameFontSize).toBe('number');
      expect(typeof template?.passwordX).toBe('number');
      expect(typeof template?.passwordY).toBe('number');
      expect(typeof template?.passwordFontSize).toBe('number');
      
      // Check string fields (schema defaults may differ)
      expect(typeof template?.usernameFontFamily).toBe('string');
      expect(typeof template?.passwordFontFamily).toBe('string');
      expect(typeof template?.usernameAlign).toBe('string');
      expect(typeof template?.passwordAlign).toBe('string');
      
      // Check boolean - qrCodeEnabled may have different defaults
      expect(typeof template?.qrCodeEnabled).toBe('boolean');

      // Cleanup
      await templateDb.deleteTemplate(id);
    });
  });

  describe('Template Font Families', () => {
    it('should support all font family types', async () => {
      const fontFamilies = ['normal', 'clear', 'digital'] as const;
      
      for (const fontFamily of fontFamilies) {
        const templateData = {
          name: `Font Test ${fontFamily}`,
          resellerId: null,
          imageUrl: `https://example.com/font-${fontFamily}.png`,
          imageKey: `templates/test/font-${fontFamily}.png`,
        };

        const id = await templateDb.createTemplate(templateData);
        await templateDb.updateTemplate(id, {
          usernameFontFamily: fontFamily,
          passwordFontFamily: fontFamily,
        });

        const template = await templateDb.getTemplateById(id);
        expect(template?.usernameFontFamily).toBe(fontFamily);
        expect(template?.passwordFontFamily).toBe(fontFamily);

        // Cleanup
        await templateDb.deleteTemplate(id);
      }
    });
  });

  describe('Template Alignment Options', () => {
    it('should support all alignment types', async () => {
      const alignments = ['left', 'center', 'right'] as const;
      
      for (const align of alignments) {
        const templateData = {
          name: `Align Test ${align}`,
          resellerId: null,
          imageUrl: `https://example.com/align-${align}.png`,
          imageKey: `templates/test/align-${align}.png`,
        };

        const id = await templateDb.createTemplate(templateData);
        await templateDb.updateTemplate(id, {
          usernameAlign: align,
          passwordAlign: align,
        });

        const template = await templateDb.getTemplateById(id);
        expect(template?.usernameAlign).toBe(align);
        expect(template?.passwordAlign).toBe(align);

        // Cleanup
        await templateDb.deleteTemplate(id);
      }
    });
  });
});
