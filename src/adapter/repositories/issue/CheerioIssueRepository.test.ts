import { CheerioIssueRepository } from './CheerioIssueRepository';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { InternalGraphqlIssueRepository } from './InternalGraphqlIssueRepository';
import dotenv from 'dotenv';
import { LocalStorageRepository } from '../LocalStorageRepository';
dotenv.config();

describe('CheerioIssueRepository', () => {
  jest.setTimeout(60 * 1000);
  class CheerioIssueRepositoryPublic extends CheerioIssueRepository {
    getStatusTimelineEventsFromCheerioObjectPublic =
      this.getStatusTimelineEventsFromCheerioObject;
    getTitleFromCheerioObjectPublic = this.getTitleFromCheerioObject;
    getStatusFromCheerioObjectPublic = this.getStatusFromCheerioObject;
    getAssigneesFromCheerioObjectPublic = this.getAssigneesFromCheerioObject;
    getLabelsFromCheerioObjectPublic = this.getLabelsFromCheerioObject;
    getProjectFromCheerioObjectPublic = this.getProjectFromCheerioObject;
  }
  const localStorageRepository = new LocalStorageRepository();

  const internalGraphqlIssueRepository = new InternalGraphqlIssueRepository(
    localStorageRepository,
    './tmp/github.com.cookies.json',
    process.env.GH_TOKEN,
  );
  const repository = new CheerioIssueRepositoryPublic(
    internalGraphqlIssueRepository,
    localStorageRepository,
    './tmp/github.com.cookies.json',
    process.env.GH_TOKEN,
  );
  beforeAll(async () => {
    await repository.refreshCookie();
  });
  beforeEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, 2000));
  });

  describe('getIssue', () => {
    it('should return issue object', async () => {
      const issue = await repository.getIssue(issueUrl);
      expect(issue).toEqual({
        assignees: ['HiromiShikata'],
        createdAt: new Date('2024-01-01'),
        inProgressTimeline: [
          {
            author: 'HiromiShikata',
            durationMinutes: 3.5166666666666666,
            endedAt: new Date('2024-04-21T09:31:46.000Z'),
            issueUrl:
              'https://github.com/HiromiShikata/test-repository/issues/38',
            startedAt: new Date('2024-04-21T09:28:15.000Z'),
          },
          {
            author: 'HiromiShikata',
            durationMinutes: 60.516666666666666,
            endedAt: new Date('2024-04-21T11:13:38.000Z'),
            issueUrl:
              'https://github.com/HiromiShikata/test-repository/issues/38',
            startedAt: new Date('2024-04-21T10:13:07.000Z'),
          },
          {
            author: 'HiromiShikata',
            durationMinutes: 0.05,
            endedAt: new Date('2024-11-23T05:44:10.000Z'),
            issueUrl:
              'https://github.com/HiromiShikata/test-repository/issues/38',
            startedAt: new Date('2024-11-23T05:44:07.000Z'),
          },
          {
            author: 'HiromiShikata',
            durationMinutes: 0.03333333333333333,
            endedAt: new Date('2024-11-23T05:46:27.000Z'),
            issueUrl:
              'https://github.com/HiromiShikata/test-repository/issues/38',
            startedAt: new Date('2024-11-23T05:46:25.000Z'),
          },
        ],
        labels: ['enhancement'],
        project: 'V2 project on owner for testing',
        status: 'Todo',
        statusTimeline: [
          {
            author: 'HiromiShikata',
            from: '',
            time: '2024-04-21T09:28:15Z',
            to: 'In Progress',
          },
          {
            author: 'HiromiShikata',
            from: 'In Progress',
            time: '2024-04-21T09:31:46Z',
            to: 'Todo',
          },
          {
            author: 'HiromiShikata',
            from: 'Todo',
            time: '2024-04-21T10:13:07Z',
            to: 'In Progress',
          },
          {
            author: 'HiromiShikata',
            from: 'In Progress',
            time: '2024-04-21T11:13:38Z',
            to: 'Todo',
          },
          {
            author: 'HiromiShikata',
            from: '',
            time: '2024-09-19T14:03:05Z',
            to: 'Todo',
          },
          {
            author: 'HiromiShikata',
            from: 'Todo',
            time: '2024-11-23T05:44:07Z',
            to: 'In Progress',
          },
          {
            author: 'HiromiShikata',
            from: 'In Progress',
            time: '2024-11-23T05:44:10Z',
            to: 'Todo',
          },
          {
            author: 'github-project-automation',
            from: 'Todo',
            time: '2024-11-23T05:45:50Z',
            to: 'Done',
          },
          {
            author: 'HiromiShikata',
            from: 'Done',
            time: '2024-11-23T05:46:22Z',
            to: 'Todo',
          },
          {
            author: 'HiromiShikata',
            from: 'Todo',
            time: '2024-11-23T05:46:25Z',
            to: 'In Progress',
          },
          {
            author: 'HiromiShikata',
            from: 'In Progress',
            time: '2024-11-23T05:46:27Z',
            to: 'Todo',
          },
        ],
        title: 'In progress test title',
        url: 'https://github.com/HiromiShikata/test-repository/issues/38',
        workingTimeline: [
          {
            author: 'HiromiShikata',
            durationMinutes: 3.5166666666666666,
            endedAt: new Date('2024-04-21T09:31:46.000Z'),
            issueUrl:
              'https://github.com/HiromiShikata/test-repository/issues/38',
            startedAt: new Date('2024-04-21T09:28:15.000Z'),
          },
          {
            author: 'HiromiShikata',
            durationMinutes: 60.516666666666666,
            endedAt: new Date('2024-04-21T11:13:38.000Z'),
            issueUrl:
              'https://github.com/HiromiShikata/test-repository/issues/38',
            startedAt: new Date('2024-04-21T10:13:07.000Z'),
          },
          {
            author: 'HiromiShikata',
            durationMinutes: 0.05,
            endedAt: new Date('2024-11-23T05:44:10.000Z'),
            issueUrl:
              'https://github.com/HiromiShikata/test-repository/issues/38',
            startedAt: new Date('2024-11-23T05:44:07.000Z'),
          },
          {
            author: 'HiromiShikata',
            durationMinutes: 0.03333333333333333,
            endedAt: new Date('2024-11-23T05:46:27.000Z'),
            issueUrl:
              'https://github.com/HiromiShikata/test-repository/issues/38',
            startedAt: new Date('2024-11-23T05:46:25.000Z'),
          },
        ],
      });
    });
  });
  describe('getIssueFromNormalView', () => {
    it('should return issue object', async () => {
      const $ = cheerio.load(issueHtml);
      const issue = await repository.getIssueFromNormalView(issueUrl, $);
      expect(issue).toEqual({
        assignees: ['HiromiShikata'],
        createdAt: new Date('2024-01-01'),
        inProgressTimeline: [],
        labels: ['enhancement'],
        project: 'V2 project on owner for testing',
        status: 'In Progress',
        statusTimeline: [
          {
            author: 'HiromiShikata',
            from: 'In Progress',
            time: '2024-04-21T09:31:46Z',
            to: 'Todo',
          },
          {
            author: 'HiromiShikata',
            from: 'Todo',
            time: '2024-04-21T10:13:07Z',
            to: 'In Progress',
          },
        ],
        title: 'In progress test title',
        url: 'https://github.com/HiromiShikata/test-repository/issues/38',
        workingTimeline: [],
      });
    });
  });
  describe('getTitleFromCheerioObject', () => {
    it('should return title', () => {
      const $ = cheerio.load(issueHtml);
      const title = repository.getTitleFromCheerioObjectPublic($);
      expect(title).toBe('In progress test title');
    });
  });
  describe('getStatusFromCheerioObject', () => {
    it('should return status', () => {
      const $ = cheerio.load(issueHtml);
      const status = repository.getStatusFromCheerioObjectPublic($);
      expect(status).toBe('In Progress');
    });
  });
  describe('getAssigneesFromCheerioObject', () => {
    it('should return assignee', () => {
      const $ = cheerio.load(issueHtml);
      const assignees = repository.getAssigneesFromCheerioObjectPublic($);
      expect(assignees).toEqual(['HiromiShikata']);
    });
  });
  describe('getLabelsFromCheerioObject', () => {
    it('should return labels', () => {
      const $ = cheerio.load(issueHtml);
      const labels = repository.getLabelsFromCheerioObjectPublic($);
      expect(labels).toEqual(['enhancement']);
    });
  });
  describe('getProjectFromCheerioObject', () => {
    it('should return project', () => {
      const $ = cheerio.load(issueHtml);
      const project = repository.getProjectFromCheerioObjectPublic($);
      expect(project).toBe('V2 project on owner for testing');
    });
  });
  describe('getStatusTimelineEvents', () => {
    it('should return status timeline events', async () => {
      const headers = await repository.createHeader();
      const content = await axios.get<string>(issueUrl, { headers });
      const $ = cheerio.load(content.data);
      const statusTimeline = await repository.getStatusTimelineEvents($);
      expect(statusTimeline).toEqual([]);
    });
  });

  const issueUrl = 'https://github.com/HiromiShikata/test-repository/issues/38';
  const issueHtml = `






<!DOCTYPE html>
<html
  lang="en"
  
  data-color-mode="dark" data-light-theme="light" data-dark-theme="dark"
  data-a11y-animated-images="system" data-a11y-link-underlines="true"
  >




  <head>
    <meta charset="utf-8">
  <link rel="dns-prefetch" href="https://github.githubassets.com">
  <link rel="dns-prefetch" href="https://avatars.githubusercontent.com">
  <link rel="dns-prefetch" href="https://github-cloud.s3.amazonaws.com">
  <link rel="dns-prefetch" href="https://user-images.githubusercontent.com/">
  <link rel="preconnect" href="https://github.githubassets.com" crossorigin>
  <link rel="preconnect" href="https://avatars.githubusercontent.com">

  

  <link crossorigin="anonymous" media="all" rel="stylesheet" href="https://github.githubassets.com/assets/dark-1ee85695b584.css" /><link data-color-theme="light" crossorigin="anonymous" media="all" rel="stylesheet" data-href="https://github.githubassets.com/assets/light-f13f84a2af0d.css" /><link data-color-theme="dark_dimmed" crossorigin="anonymous" media="all" rel="stylesheet" data-href="https://github.githubassets.com/assets/dark_dimmed-8c42799cfb52.css" /><link data-color-theme="dark_high_contrast" crossorigin="anonymous" media="all" rel="stylesheet" data-href="https://github.githubassets.com/assets/dark_high_contrast-dc99d916bf90.css" /><link data-color-theme="dark_colorblind" crossorigin="anonymous" media="all" rel="stylesheet" data-href="https://github.githubassets.com/assets/dark_colorblind-0a83868d0e43.css" /><link data-color-theme="light_colorblind" crossorigin="anonymous" media="all" rel="stylesheet" data-href="https://github.githubassets.com/assets/light_colorblind-3c798f5a8bef.css" /><link data-color-theme="light_high_contrast" crossorigin="anonymous" media="all" rel="stylesheet" data-href="https://github.githubassets.com/assets/light_high_contrast-4c72a7f3b765.css" /><link data-color-theme="light_tritanopia" crossorigin="anonymous" media="all" rel="stylesheet" data-href="https://github.githubassets.com/assets/light_tritanopia-222bf22536c7.css" /><link data-color-theme="dark_tritanopia" crossorigin="anonymous" media="all" rel="stylesheet" data-href="https://github.githubassets.com/assets/dark_tritanopia-c1d9496197fa.css" />
    <link crossorigin="anonymous" media="all" rel="stylesheet" href="https://github.githubassets.com/assets/primer-primitives-0b5bee5c70e9.css" />
    <link crossorigin="anonymous" media="all" rel="stylesheet" href="https://github.githubassets.com/assets/primer-44fa1513ddd0.css" />
    <link crossorigin="anonymous" media="all" rel="stylesheet" href="https://github.githubassets.com/assets/global-1c8bb26336c1.css" />
    <link crossorigin="anonymous" media="all" rel="stylesheet" href="https://github.githubassets.com/assets/github-07f750db5d7c.css" />
  <link crossorigin="anonymous" media="all" rel="stylesheet" href="https://github.githubassets.com/assets/repository-fa69f138fe8d.css" />

  


  <script type="application/json" id="client-env">{"locale":"en","featureFlags":["code_vulnerability_scanning","copilot_conversational_ux_history_refs","copilot_smell_icebreaker_ux","copilot_implicit_context","failbot_handle_non_errors","geojson_azure_maps","image_metric_tracking","marketing_forms_api_integration_contact_request","marketing_pages_search_explore_provider","repository_suggester_elastic_search","turbo_experiment_risky","sample_network_conn_type","no_character_key_shortcuts_in_inputs","react_start_transition_for_navigations","custom_inp","remove_child_patch"]}</script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/wp-runtime-458b37c69c80.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/vendors-node_modules_dompurify_dist_purify_js-6890e890956f.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/vendors-node_modules_oddbird_popover-polyfill_dist_popover_js-7bd350d761f4.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/vendors-node_modules_smoothscroll-polyfill_dist_smoothscroll_js-node_modules_stacktrace-parse-a448e4-bb5415637fe0.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/environment-775215f6b8df.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/vendors-node_modules_github_selector-observer_dist_index_esm_js-9f960d9b217c.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/vendors-node_modules_primer_behaviors_dist_esm_focus-zone_js-086f7a27bac0.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/vendors-node_modules_github_relative-time-element_dist_index_js-c76945c5961a.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/vendors-node_modules_github_combobox-nav_dist_index_js-node_modules_github_markdown-toolbar-e-820fc0-bc8f02b96749.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/vendors-node_modules_github_auto-complete-element_dist_index_js-03fc21f4e80c.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/vendors-node_modules_github_text-expander-element_dist_index_js-8a621df59e80.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/vendors-node_modules_delegated-events_dist_index_js-node_modules_stacktrace-parser_dist_stack-443cd5-1ba4dbac454f.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/vendors-node_modules_github_filter-input-element_dist_index_js-node_modules_github_remote-inp-b7d8f4-7dc906febe69.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/vendors-node_modules_github_file-attachment-element_dist_index_js-node_modules_primer_view-co-27181b-3509ed8075c4.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/app_assets_modules_github_onfocus_ts-ui_packages_trusted-types-policies_policy_ts-ui_packages-6fe316-745e8b6794ab.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/github-elements-34cbf079a4f4.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/element-registry-7b1a26c350a5.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/vendors-node_modules_github_catalyst_lib_index_js-node_modules_github_hydro-analytics-client_-4da1df-9de8d527f925.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/vendors-node_modules_braintree_browser-detection_dist_browser-detection_js-node_modules_githu-fd5530-6fc33e963fc0.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/vendors-node_modules_lit-html_lit-html_js-5b376145beff.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/vendors-node_modules_morphdom_dist_morphdom-esm_js-node_modules_github_memoize_dist_esm_index_js-05801f7ca718.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/vendors-node_modules_github_turbo_dist_turbo_es2017-esm_js-c91f4ad18b62.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/vendors-node_modules_github_remote-form_dist_index_js-node_modules_delegated-events_dist_inde-893f9f-a8ec7ed862cf.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/vendors-node_modules_scroll-anchoring_dist_scroll-anchoring_esm_js-node_modules_github_detail-c9d0ba-387cde917623.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/vendors-node_modules_color-convert_index_js-72c9fbde5ad4.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/vendors-node_modules_primer_behaviors_dist_esm_dimensions_js-node_modules_github_jtml_lib_index_js-95b84ee6bc34.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/vendors-node_modules_github_quote-selection_dist_index_js-node_modules_github_session-resume_-84957b-7b4e472db160.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/ui_packages_sudo_sudo_ts-eff4af278797.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/app_assets_modules_github_updatable-content_ts-ui_packages_hydro-analytics_hydro-analytics_ts-82813f-05346aa543fe.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/app_assets_modules_github_behaviors_task-list_ts-app_assets_modules_github_onfocus_ts-app_ass-421cec-355eb4940fad.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/app_assets_modules_github_sticky-scroll-into-view_ts-94209c43e6af.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/app_assets_modules_github_behaviors_ajax-error_ts-app_assets_modules_github_behaviors_include-467754-782c9388f902.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/app_assets_modules_github_behaviors_commenting_edit_ts-app_assets_modules_github_behaviors_ht-83c235-9285faa0e011.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/behaviors-7f67a24be639.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/vendors-node_modules_delegated-events_dist_index_js-node_modules_github_catalyst_lib_index_js-06ff531-2ea61fcc9a71.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/notifications-global-6d6db5144cc3.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/vendors-node_modules_github_mini-throttle_dist_index_js-node_modules_github_remote-form_dist_-a2dc8f-f8c2a3c28fe9.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/issues-54e0ffe3d55b.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/structured-issues-824032d0dc78.js"></script>
  

  <title>In progress test title · Issue #38 · HiromiShikata/test-repository</title>



  <meta name="route-pattern" content="/_view_fragments/issues/show/:user_id/:repository/:id/issue_layout(.:format)" data-turbo-transient>
  <meta name="route-controller" content="voltron_issues_fragments" data-turbo-transient>
  <meta name="route-action" content="issue_layout" data-turbo-transient>

    
  <meta name="current-catalog-service-hash" content="81bb79d38c15960b92d99bca9288a9108c7a47b18f2423d0f6438c5b7bcd2114">


  <meta name="request-id" content="9680:1793D:4F52734:6D3F77C:6624EEA0" data-turbo-transient="true" /><meta name="html-safe-nonce" content="c1302452fe8b0f5b19d83c1a00acff49416be9d115fe1eeb779b8856ef7aa77b" data-turbo-transient="true" /><meta name="visitor-payload" content="eyJyZWZlcnJlciI6Imh0dHBzOi8vZ2l0aHViLmNvbS9vcmdzL2NvbW11bml0eS9kaXNjdXNzaW9ucy8zMDk3OSIsInJlcXVlc3RfaWQiOiI5NjgwOjE3OTNEOjRGNTI3MzQ6NkQzRjc3Qzo2NjI0RUVBMCIsInZpc2l0b3JfaWQiOiI2NTUxNDU0OTA0OTkxODkzMTU3IiwicmVnaW9uX2VkZ2UiOiJpYWQiLCJyZWdpb25fcmVuZGVyIjoiaWFkIn0=" data-turbo-transient="true" /><meta name="visitor-hmac" content="7b7d11ff84aec5f59a8c5c9de8843c57f74e714d72fea1f560c55e83c69aebe0" data-turbo-transient="true" />


    <meta name="hovercard-subject-tag" content="issue:2254985370" data-turbo-transient>


  <meta name="github-keyboard-shortcuts" content="repository,issues,copilot" data-turbo-transient="true" />
  

  <meta name="selected-link" value="repo_issues" data-turbo-transient>
  <link rel="assets" href="https://github.githubassets.com/">

    <meta name="google-site-verification" content="c1kuD-K2HIVF635lypcsWPoD4kilo5-jA_wBFyT4uMY">
  <meta name="google-site-verification" content="KT5gs8h0wvaagLKAVWq8bbeNwnZZK1r1XQysX3xurLU">
  <meta name="google-site-verification" content="ZzhVyEFwb7w3e0-uOTltm8Jsck2F5StVihD0exw2fsA">
  <meta name="google-site-verification" content="GXs5KoUUkNCoaAZn7wPN-t01Pywp9M3sEjnt_3_ZWPc">
  <meta name="google-site-verification" content="Apib7-x98H0j5cPqHWwSMm6dNU4GmODRoqxLiDzdx9I">

<meta name="octolytics-url" content="https://collector.github.com/github/collect" /><meta name="octolytics-actor-id" content="6440811" /><meta name="octolytics-actor-login" content="HiromiShikata" /><meta name="octolytics-actor-hash" content="6b3b32d5f81d0e443d4dd73d1e6b6f8f6f5bb863917b12e776d65759d87bfb81" />

  <meta name="analytics-location" content="/&lt;user-name&gt;/&lt;repo-name&gt;/voltron/issues_fragments/issue_layout" data-turbo-transient="true" />

  





    <meta name="user-login" content="HiromiShikata">

  <link rel="sudo-modal" href="/sessions/sudo_modal">

    <meta name="viewport" content="width=device-width">

    

      <meta name="description" content="Test description checkbox 1 list item 1 list item 2">

      <link rel="search" type="application/opensearchdescription+xml" href="/opensearch.xml" title="GitHub">

    <link rel="fluid-icon" href="https://github.com/fluidicon.png" title="GitHub">
    <meta property="fb:app_id" content="1401488693436528">
    <meta name="apple-itunes-app" content="app-id=1477376905, app-argument=https://github.com/_view_fragments/issues/show/HiromiShikata/test-repository/38/issue_layout" />

      <meta name="twitter:image:src" content="https://opengraph.githubassets.com/f2b5a3acae2c4e5f06afaf4e43fae78a3fe0a8803a255e457a0867e6adbc865f/HiromiShikata/test-repository/issues/38" /><meta name="twitter:site" content="@github" /><meta name="twitter:card" content="summary_large_image" /><meta name="twitter:title" content="In progress test title · Issue #38 · HiromiShikata/test-repository" /><meta name="twitter:description" content="Test description checkbox 1 list item 1 list item 2" />
  <meta property="og:image" content="https://opengraph.githubassets.com/f2b5a3acae2c4e5f06afaf4e43fae78a3fe0a8803a255e457a0867e6adbc865f/HiromiShikata/test-repository/issues/38" /><meta property="og:image:alt" content="Test description checkbox 1 list item 1 list item 2" /><meta property="og:image:width" content="1200" /><meta property="og:image:height" content="600" /><meta property="og:site_name" content="GitHub" /><meta property="og:type" content="object" /><meta property="og:title" content="In progress test title · Issue #38 · HiromiShikata/test-repository" /><meta property="og:url" content="https://github.com/HiromiShikata/test-repository/issues/38" /><meta property="og:description" content="Test description checkbox 1 list item 1 list item 2" /><meta property="og:author:username" content="HiromiShikata" />
  


      <link rel="shared-web-socket" href="wss://alive.github.com/_sockets/u/6440811/ws?session=eyJ2IjoiVjMiLCJ1Ijo2NDQwODExLCJzIjoxMzQ3NzEyNjMyLCJjIjoyMTE5MTAyNDEyLCJ0IjoxNzEzNjk2NDE2fQ==--680659cc0251597890f424e8beee6d921b60404d7e7c3fd6eeae84efcfc341e9" data-refresh-url="/_alive" data-session-id="1ed55061164fb8759350e260323de0e857d9a729a114a275d610db401934771e">
      <link rel="shared-web-socket-src" href="/assets-cdn/worker/socket-worker-9cc1149b224c.js">


      <meta name="hostname" content="github.com">


      <meta name="keyboard-shortcuts-preference" content="all">

        <meta name="expected-hostname" content="github.com">


  <meta http-equiv="x-pjax-version" content="b1ade0cb4857ac2d2cefc801c1225cfaf97dabe738a5e39a31986d89a1ffdcbc" data-turbo-track="reload">
  <meta http-equiv="x-pjax-csp-version" content="f226bf37af9c33162063db3eb018fed7f088f86d0a20ca54c013fda96c7f2e05" data-turbo-track="reload">
  <meta http-equiv="x-pjax-css-version" content="c7c53f4a8c1805ddf3ad2b644dd42a4962efe1cdc844e0f7d13ea6efe106ef15" data-turbo-track="reload">
  <meta http-equiv="x-pjax-js-version" content="84fc613c9349d113dbb69b0603c642bb965645b431c137d5d7b5b3583d9ee2b4" data-turbo-track="reload">

  <meta name="turbo-cache-control" content="no-preview" data-turbo-transient="">

        <meta name="voltron-timing" value="348">
  <meta name="go-import" content="github.com/HiromiShikata/test-repository git https://github.com/HiromiShikata/test-repository.git">

  <meta name="octolytics-dimension-user_id" content="6440811" /><meta name="octolytics-dimension-user_login" content="HiromiShikata" /><meta name="octolytics-dimension-repository_id" content="148233297" /><meta name="octolytics-dimension-repository_nwo" content="HiromiShikata/test-repository" /><meta name="octolytics-dimension-repository_public" content="true" /><meta name="octolytics-dimension-repository_is_fork" content="false" /><meta name="octolytics-dimension-repository_network_root_id" content="148233297" /><meta name="octolytics-dimension-repository_network_root_nwo" content="HiromiShikata/test-repository" />



    

    <meta name="turbo-body-classes" content="logged-in env-production page-responsive">


  <meta name="browser-stats-url" content="https://api.github.com/_private/browser/stats">

  <meta name="browser-errors-url" content="https://api.github.com/_private/browser/errors">

  <link rel="mask-icon" href="https://github.githubassets.com/assets/pinned-octocat-093da3e6fa40.svg" color="#000000">
  <link rel="alternate icon" class="js-site-favicon" type="image/png" href="https://github.githubassets.com/favicons/favicon.png">
  <link rel="icon" class="js-site-favicon" type="image/svg+xml" href="https://github.githubassets.com/favicons/favicon.svg">

<meta name="theme-color" content="#1e2327">
<meta name="color-scheme" content="dark light" />


  <link rel="manifest" href="/manifest.json" crossOrigin="use-credentials">

  </head>

  <body class="logged-in env-production page-responsive" style="word-wrap: break-word;">
    <div data-turbo-body class="logged-in env-production page-responsive" style="word-wrap: break-word;">
      


    <div class="position-relative js-header-wrapper ">
      <a href="#start-of-content" class="p-3 color-bg-accent-emphasis color-fg-on-emphasis show-on-focus js-skip-to-content">Skip to content</a>
      <span data-view-component="true" class="progress-pjax-loader Progress position-fixed width-full">
    <span style="width: 0%;" data-view-component="true" class="Progress-item progress-pjax-loader-bar left-0 top-0 color-bg-accent-emphasis"></span>
</span>      
      
      

<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/react-lib-1fbfc5be2c18.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/vendors-node_modules_primer_octicons-react_dist_index_esm_js-node_modules_primer_react_lib-es-541a38-6ce7d7c3f9ee.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/vendors-node_modules_primer_react_lib-esm_Box_Box_js-8f8c5e2a2cbf.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/vendors-node_modules_primer_react_lib-esm_Button_Button_js-95a7748e3c39.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/vendors-node_modules_primer_react_node_modules_primer_octicons-react_dist_index_esm_mjs-cb996b1b8e38.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/vendors-node_modules_primer_react_lib-esm_TooltipV2_Tooltip_js-a1d2cb4ed6ce.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/vendors-node_modules_primer_react_lib-esm_ActionList_index_js-e55780ce0aba.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/vendors-node_modules_primer_react_lib-esm_Button_IconButton_js-node_modules_primer_react_lib--b964b4-6ad237e6932f.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/ui_packages_react-core_create-browser-history_ts-ui_packages_safe-storage_safe-storage_ts-ui_-682c2c-e45e451173ec.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/keyboard-shortcuts-dialog-b4a646a773af.js"></script>

<react-partial
  partial-name="keyboard-shortcuts-dialog"
  data-ssr="false"
>
  
  <script type="application/json" data-target="react-partial.embeddedData">{"props":{"docsUrl":"https://docs.github.com/get-started/accessibility/keyboard-shortcuts"}}</script>
  <div data-target="react-partial.reactRoot"></div>
</react-partial>




      

        <script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/vendors-node_modules_allex_crc32_lib_crc32_esm_js-node_modules_github_mini-throttle_dist_deco-a9eeba-71c75674fb56.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/vendors-node_modules_github_clipboard-copy-element_dist_index_esm_js-node_modules_delegated-e-b37f7d-6c7c27fd1f12.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/app_assets_modules_github_command-palette_items_help-item_ts-app_assets_modules_github_comman-48ad9d-5590c6b89be0.js"></script>
<script crossorigin="anonymous" defer="defer" type="application/javascript" src="https://github.githubassets.com/assets/command-palette-828642dbfb4e.js"></script>

            <header class="AppHeader">
    

    <div class="AppHeader-globalBar pb-2 js-global-bar">
      <div class="AppHeader-globalBar-start">
          <deferred-side-panel data-url="/_side-panels/global">
  <include-fragment data-target="deferred-side-panel.fragment">
      <button aria-label="Open global navigation menu" data-action="click:deferred-side-panel#loadPanel click:deferred-side-panel#panelOpened" data-show-dialog-id="dialog-dd3d9652-347a-4ee9-9035-ca0f843b032a" id="dialog-show-dialog-dd3d9652-347a-4ee9-9035-ca0f843b032a" type="button" data-view-component="true" class="Button Button--iconOnly Button--secondary Button--medium AppHeader-button color-bg-transparent p-0 color-fg-muted">  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-three-bars Button-visual">
    <path d="M1 2.75A.75.75 0 0 1 1.75 2h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 2.75Zm0 5A.75.75 0 0 1 1.75 7h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 7.75ZM1.75 12h12.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1 0-1.5Z"></path>
</svg>
</button>

<dialog-helper>
  <dialog data-target="deferred-side-panel.panel" id="dialog-dd3d9652-347a-4ee9-9035-ca0f843b032a" aria-modal="true" aria-labelledby="dialog-dd3d9652-347a-4ee9-9035-ca0f843b032a-title" aria-describedby="dialog-dd3d9652-347a-4ee9-9035-ca0f843b032a-description" data-view-component="true" class="Overlay Overlay-whenNarrow Overlay--size-small-portrait Overlay--motion-scaleFade Overlay--placement-left SidePanel">
    <div styles="flex-direction: row;" data-view-component="true" class="Overlay-header">
  <div class="Overlay-headerContentWrap">
    <div class="Overlay-titleWrap">
      <h1 class="Overlay-title sr-only" id="dialog-dd3d9652-347a-4ee9-9035-ca0f843b032a-title">
        Global navigation
      </h1>
            <div data-view-component="true" class="d-flex">
      <div data-view-component="true" class="AppHeader-logo position-relative">
        <svg aria-hidden="true" height="24" viewBox="0 0 16 16" version="1.1" width="24" data-view-component="true" class="octicon octicon-mark-github">
    <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"></path>
</svg>
</div></div>
    </div>
    <div class="Overlay-actionWrap">
      <button data-close-dialog-id="dialog-dd3d9652-347a-4ee9-9035-ca0f843b032a" aria-label="Close" type="button" data-view-component="true" class="close-button Overlay-closeButton"><svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-x">
    <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path>
</svg></button>
    </div>
  </div>
</div>
      <scrollable-region data-labelled-by="dialog-dd3d9652-347a-4ee9-9035-ca0f843b032a-title">
        <div data-view-component="true" class="Overlay-body d-flex flex-column px-2">    <div data-view-component="true" class="d-flex flex-column mb-3">
        <nav aria-label="Site navigation" data-view-component="true" class="ActionList">
  
  <nav-list>
    <ul data-target="nav-list.topLevelList" data-view-component="true" class="ActionListWrap">
        
          
<li data-item-id="" data-targets="nav-list.items" data-view-component="true" class="ActionListItem">
    
    <a data-hotkey="g d" data-analytics-event="{&quot;category&quot;:&quot;Global navigation&quot;,&quot;action&quot;:&quot;HOME&quot;,&quot;label&quot;:null}" id="item-9513b156-a134-4588-8a63-7721233225e7" href="/dashboard" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-home">
    <path d="M6.906.664a1.749 1.749 0 0 1 2.187 0l5.25 4.2c.415.332.657.835.657 1.367v7.019A1.75 1.75 0 0 1 13.25 15h-3.5a.75.75 0 0 1-.75-.75V9H7v5.25a.75.75 0 0 1-.75.75h-3.5A1.75 1.75 0 0 1 1 13.25V6.23c0-.531.242-1.034.657-1.366l5.25-4.2Zm1.25 1.171a.25.25 0 0 0-.312 0l-5.25 4.2a.25.25 0 0 0-.094.196v7.019c0 .138.112.25.25.25H5.5V8.25a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 .75.75v5.25h2.75a.25.25 0 0 0 .25-.25V6.23a.25.25 0 0 0-.094-.195Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Home
</span></a>
  
  
</li>

        
          
<li data-item-id="" data-targets="nav-list.items" data-view-component="true" class="ActionListItem">
    
    <a data-hotkey="g i" data-analytics-event="{&quot;category&quot;:&quot;Global navigation&quot;,&quot;action&quot;:&quot;ISSUES&quot;,&quot;label&quot;:null}" id="item-3fa48498-95c9-49c5-b790-aed8a4ed2380" href="/issues" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-issue-opened">
    <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"></path><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Issues
</span></a>
  
  
</li>

        
          
<li data-item-id="" data-targets="nav-list.items" data-view-component="true" class="ActionListItem">
    
    <a data-hotkey="g p" data-analytics-event="{&quot;category&quot;:&quot;Global navigation&quot;,&quot;action&quot;:&quot;PULL_REQUESTS&quot;,&quot;label&quot;:null}" id="item-828ac075-8fd6-4599-a23d-5115b4d2b69a" href="/pulls" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-git-pull-request">
    <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Pull requests
</span></a>
  
  
</li>

        
          
<li data-item-id="" data-targets="nav-list.items" data-item-id="projects" data-view-component="true" class="ActionListItem">
    
    <a data-analytics-event="{&quot;category&quot;:&quot;Global navigation&quot;,&quot;action&quot;:&quot;PROJECTS&quot;,&quot;label&quot;:null}" id="item-33b371bc-5182-4dc8-a28d-534b8f03b9c0" href="/projects" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-table">
    <path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25ZM6.5 6.5v8h7.75a.25.25 0 0 0 .25-.25V6.5Zm8-1.5V1.75a.25.25 0 0 0-.25-.25H6.5V5Zm-13 1.5v7.75c0 .138.112.25.25.25H5v-8ZM5 5V1.5H1.75a.25.25 0 0 0-.25.25V5Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Projects
</span></a>
  
  
</li>

        
          
<li data-item-id="" data-targets="nav-list.items" data-view-component="true" class="ActionListItem">
    
    <a data-analytics-event="{&quot;category&quot;:&quot;Global navigation&quot;,&quot;action&quot;:&quot;DISCUSSIONS&quot;,&quot;label&quot;:null}" id="item-dbaebd74-a7ca-4eef-b242-02efe0a1fcae" href="/discussions" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-comment-discussion">
    <path d="M1.75 1h8.5c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 10.25 10H7.061l-2.574 2.573A1.458 1.458 0 0 1 2 11.543V10h-.25A1.75 1.75 0 0 1 0 8.25v-5.5C0 1.784.784 1 1.75 1ZM1.5 2.75v5.5c0 .138.112.25.25.25h1a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h3.5a.25.25 0 0 0 .25-.25v-5.5a.25.25 0 0 0-.25-.25h-8.5a.25.25 0 0 0-.25.25Zm13 2a.25.25 0 0 0-.25-.25h-.5a.75.75 0 0 1 0-1.5h.5c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 14.25 12H14v1.543a1.458 1.458 0 0 1-2.487 1.03L9.22 12.28a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215l2.22 2.22v-2.19a.75.75 0 0 1 .75-.75h1a.25.25 0 0 0 .25-.25Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Discussions
</span></a>
  
  
</li>

        
          
<li data-item-id="" data-targets="nav-list.items" data-view-component="true" class="ActionListItem">
    
    <a data-analytics-event="{&quot;category&quot;:&quot;Global navigation&quot;,&quot;action&quot;:&quot;CODESPACES&quot;,&quot;label&quot;:null}" id="item-c7c38c8b-8411-46d6-9e43-d5cf108cceac" href="https://github.com/codespaces" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-codespaces">
    <path d="M0 11.25c0-.966.784-1.75 1.75-1.75h12.5c.966 0 1.75.784 1.75 1.75v3A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25Zm2-9.5C2 .784 2.784 0 3.75 0h8.5C13.216 0 14 .784 14 1.75v5a1.75 1.75 0 0 1-1.75 1.75h-8.5A1.75 1.75 0 0 1 2 6.75Zm1.75-.25a.25.25 0 0 0-.25.25v5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-5a.25.25 0 0 0-.25-.25Zm-2 9.5a.25.25 0 0 0-.25.25v3c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25v-3a.25.25 0 0 0-.25-.25Z"></path><path d="M7 12.75a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1-.75-.75Zm-4 0a.75.75 0 0 1 .75-.75h.5a.75.75 0 0 1 0 1.5h-.5a.75.75 0 0 1-.75-.75Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Codespaces
</span></a>
  
  
</li>

        
          <li role="presentation" aria-hidden="true" data-view-component="true" class="ActionList-sectionDivider"></li>
        
          
<li data-item-id="" data-targets="nav-list.items" data-view-component="true" class="ActionListItem">
    
    <a data-analytics-event="{&quot;category&quot;:&quot;Global navigation&quot;,&quot;action&quot;:&quot;EXPLORE&quot;,&quot;label&quot;:null}" id="item-3aa77471-3df9-4af2-bb27-fad588e46c29" href="/explore" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-telescope">
    <path d="M14.184 1.143v-.001l1.422 2.464a1.75 1.75 0 0 1-.757 2.451L3.104 11.713a1.75 1.75 0 0 1-2.275-.702l-.447-.775a1.75 1.75 0 0 1 .53-2.32L11.682.573a1.748 1.748 0 0 1 2.502.57Zm-4.709 9.32h-.001l2.644 3.863a.75.75 0 1 1-1.238.848l-1.881-2.75v2.826a.75.75 0 0 1-1.5 0v-2.826l-1.881 2.75a.75.75 0 1 1-1.238-.848l2.049-2.992a.746.746 0 0 1 .293-.253l1.809-.87a.749.749 0 0 1 .944.252ZM9.436 3.92h-.001l-4.97 3.39.942 1.63 5.42-2.61Zm3.091-2.108h.001l-1.85 1.26 1.505 2.605 2.016-.97a.247.247 0 0 0 .13-.151.247.247 0 0 0-.022-.199l-1.422-2.464a.253.253 0 0 0-.161-.119.254.254 0 0 0-.197.038ZM1.756 9.157a.25.25 0 0 0-.075.33l.447.775a.25.25 0 0 0 .325.1l1.598-.769-.83-1.436-1.465 1Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Explore
</span></a>
  
  
</li>

        
          
<li data-item-id="" data-targets="nav-list.items" data-view-component="true" class="ActionListItem">
    
    <a data-analytics-event="{&quot;category&quot;:&quot;Global navigation&quot;,&quot;action&quot;:&quot;MARKETPLACE&quot;,&quot;label&quot;:null}" id="item-2e55c882-dc17-4f69-888a-9a67bf51b301" href="/marketplace" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-gift">
    <path d="M2 2.75A2.75 2.75 0 0 1 4.75 0c.983 0 1.873.42 2.57 1.232.268.318.497.668.68 1.042.183-.375.411-.725.68-1.044C9.376.42 10.266 0 11.25 0a2.75 2.75 0 0 1 2.45 4h.55c.966 0 1.75.784 1.75 1.75v2c0 .698-.409 1.301-1 1.582v4.918A1.75 1.75 0 0 1 13.25 16H2.75A1.75 1.75 0 0 1 1 14.25V9.332C.409 9.05 0 8.448 0 7.75v-2C0 4.784.784 4 1.75 4h.55c-.192-.375-.3-.8-.3-1.25ZM7.25 9.5H2.5v4.75c0 .138.112.25.25.25h4.5Zm1.5 0v5h4.5a.25.25 0 0 0 .25-.25V9.5Zm0-4V8h5.5a.25.25 0 0 0 .25-.25v-2a.25.25 0 0 0-.25-.25Zm-7 0a.25.25 0 0 0-.25.25v2c0 .138.112.25.25.25h5.5V5.5h-5.5Zm3-4a1.25 1.25 0 0 0 0 2.5h2.309c-.233-.818-.542-1.401-.878-1.793-.43-.502-.915-.707-1.431-.707ZM8.941 4h2.309a1.25 1.25 0 0 0 0-2.5c-.516 0-1 .205-1.43.707-.337.392-.646.975-.879 1.793Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Marketplace
</span></a>
  
  
</li>

</ul>  </nav-list>
</nav>

        <div data-view-component="true" class="my-3 d-flex flex-justify-center height-full">
          <svg style="box-sizing: content-box; color: var(--color-icon-primary);" width="16" height="16" viewBox="0 0 16 16" fill="none" data-view-component="true" class="anim-rotate">
  <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-opacity="0.25" stroke-width="2" vector-effect="non-scaling-stroke" fill="none" />
  <path d="M15 8a7.002 7.002 0 00-7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke" />
</svg>
</div>
</div>
      <div data-view-component="true" class="flex-1"></div>


      <div data-view-component="true" class="px-2">      <p class="color-fg-subtle text-small text-light">&copy; 2024 GitHub, Inc.</p>

      <div data-view-component="true" class="d-flex flex-wrap text-small text-light">
          <a target="_blank" href="https://github.com/about" data-view-component="true" class="Link mr-2">About</a>
          <a target="_blank" href="https://github.blog" data-view-component="true" class="Link mr-2">Blog</a>
          <a target="_blank" href="https://docs.github.com/site-policy/github-terms/github-terms-of-service" data-view-component="true" class="Link mr-2">Terms</a>
          <a target="_blank" href="https://docs.github.com/site-policy/privacy-policies/github-privacy-statement" data-view-component="true" class="Link mr-2">Privacy</a>
          <a target="_blank" href="https://github.com/security" data-view-component="true" class="Link mr-2">Security</a>
          <a target="_blank" href="https://www.githubstatus.com/" data-view-component="true" class="Link mr-3">Status</a>

</div></div>
</div>
      </scrollable-region>
      
</dialog></dialog-helper>

  </include-fragment>
</deferred-side-panel>

        <a
          class="AppHeader-logo ml-2"
          href="https://github.com/"
          data-hotkey="g d"
          aria-label="Homepage "
          data-turbo="false"
          data-analytics-event="{&quot;category&quot;:&quot;Header&quot;,&quot;action&quot;:&quot;go to dashboard&quot;,&quot;label&quot;:&quot;icon:logo&quot;}"
        >
          <svg height="32" aria-hidden="true" viewBox="0 0 16 16" version="1.1" width="32" data-view-component="true" class="octicon octicon-mark-github v-align-middle color-fg-default">
    <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"></path>
</svg>
        </a>

          <div class="AppHeader-context" >
  <div class="AppHeader-context-compact">
      <button aria-expanded="false" aria-haspopup="dialog" aria-label="Page context: HiromiShikata / test-repository" id="dialog-show-context-region-dialog" data-show-dialog-id="context-region-dialog" type="button" data-view-component="true" class="AppHeader-context-compact-trigger Truncate Button--secondary Button--medium Button box-shadow-none">  <span class="Button-content">
    <span class="Button-label"><span class="AppHeader-context-compact-lead">
                <span class="AppHeader-context-compact-parentItem">HiromiShikata</span>
                <span class="no-wrap">&nbsp;/</span>

            </span>

            <strong class="AppHeader-context-compact-mainItem d-flex flex-items-center Truncate" >
  <span class="Truncate-text ">test-repository</span>

</strong></span>
  </span>
</button>

<dialog-helper>
  <dialog id="context-region-dialog" aria-modal="true" aria-labelledby="context-region-dialog-title" aria-describedby="context-region-dialog-description" data-view-component="true" class="Overlay Overlay-whenNarrow Overlay--size-medium Overlay--motion-scaleFade">
    <div data-view-component="true" class="Overlay-header">
  <div class="Overlay-headerContentWrap">
    <div class="Overlay-titleWrap">
      <h1 class="Overlay-title " id="context-region-dialog-title">
        Navigate back to
      </h1>
    </div>
    <div class="Overlay-actionWrap">
      <button data-close-dialog-id="context-region-dialog" aria-label="Close" type="button" data-view-component="true" class="close-button Overlay-closeButton"><svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-x">
    <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path>
</svg></button>
    </div>
  </div>
</div>
      <scrollable-region data-labelled-by="context-region-dialog-title">
        <div data-view-component="true" class="Overlay-body">          <ul role="list" class="list-style-none" >
    <li>
      <a data-analytics-event="{&quot;category&quot;:&quot;SiteHeaderComponent&quot;,&quot;action&quot;:&quot;context_region_crumb&quot;,&quot;label&quot;:&quot;HiromiShikata&quot;,&quot;screen_size&quot;:&quot;compact&quot;}" href="/HiromiShikata" data-view-component="true" class="Link--primary Truncate d-flex flex-items-center py-1">
        <span class="AppHeader-context-item-label Truncate-text ">
            <svg aria-hidden="true" height="12" viewBox="0 0 16 16" version="1.1" width="12" data-view-component="true" class="octicon octicon-person mr-1">
    <path d="M10.561 8.073a6.005 6.005 0 0 1 3.432 5.142.75.75 0 1 1-1.498.07 4.5 4.5 0 0 0-8.99 0 .75.75 0 0 1-1.498-.07 6.004 6.004 0 0 1 3.431-5.142 3.999 3.999 0 1 1 5.123 0ZM10.5 5a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"></path>
</svg>

          HiromiShikata
        </span>

</a>
    </li>
    <li>
      <a data-analytics-event="{&quot;category&quot;:&quot;SiteHeaderComponent&quot;,&quot;action&quot;:&quot;context_region_crumb&quot;,&quot;label&quot;:&quot;test-repository&quot;,&quot;screen_size&quot;:&quot;compact&quot;}" href="/HiromiShikata/test-repository" data-view-component="true" class="Link--primary Truncate d-flex flex-items-center py-1">
        <span class="AppHeader-context-item-label Truncate-text ">
            <svg aria-hidden="true" height="12" viewBox="0 0 16 16" version="1.1" width="12" data-view-component="true" class="octicon octicon-repo mr-1">
    <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z"></path>
</svg>

          test-repository
        </span>

</a>
    </li>
</ul>

</div>
      </scrollable-region>
      
</dialog></dialog-helper>
  </div>

  <div class="AppHeader-context-full">
    <nav role="navigation" aria-label="Page context">
      <ul role="list" class="list-style-none" >
    <li>
      <a data-analytics-event="{&quot;category&quot;:&quot;SiteHeaderComponent&quot;,&quot;action&quot;:&quot;context_region_crumb&quot;,&quot;label&quot;:&quot;HiromiShikata&quot;,&quot;screen_size&quot;:&quot;full&quot;}" data-hovercard-type="user" data-hovercard-url="/users/HiromiShikata/hovercard" data-octo-click="hovercard-link-click" data-octo-dimensions="link_type:self" href="/HiromiShikata" data-view-component="true" class="AppHeader-context-item">
        <span class="AppHeader-context-item-label  ">

          HiromiShikata
        </span>

</a>
        <span class="AppHeader-context-item-separator">/</span>
    </li>
    <li>
      <a data-analytics-event="{&quot;category&quot;:&quot;SiteHeaderComponent&quot;,&quot;action&quot;:&quot;context_region_crumb&quot;,&quot;label&quot;:&quot;test-repository&quot;,&quot;screen_size&quot;:&quot;full&quot;}" href="/HiromiShikata/test-repository" data-view-component="true" class="AppHeader-context-item">
        <span class="AppHeader-context-item-label  ">

          test-repository
        </span>

</a>
    </li>
</ul>

    </nav>
  </div>
</div>

      </div>
      <div class="AppHeader-globalBar-end">
          <div class="AppHeader-search" >
              


<qbsearch-input class="search-input" data-scope="repo:HiromiShikata/test-repository" data-custom-scopes-path="/search/custom_scopes" data-delete-custom-scopes-csrf="Liq90ExuTGTF1ovNFc8XPCcuuAyhvREA4BT3cV6AK2CMqzRDsd6pS1sr1PmOv_D4WeyjLfs42g73ij_D2ktncw" data-max-custom-scopes="10" data-header-redesign-enabled="true" data-initial-value="" data-blackbird-suggestions-path="/search/suggestions" data-jump-to-suggestions-path="/_graphql/GetSuggestedNavigationDestinations" data-current-repository="HiromiShikata/test-repository" data-current-org="" data-current-owner="HiromiShikata" data-logged-in="true" data-copilot-chat-enabled="false" data-blackbird-indexed-repo-csrf="<input type=&quot;hidden&quot; value=&quot;Dxdz0BhkvOr_lDg-HPAUxzfeV88g7ca4dTinijCga5GPumjn79mQoI83eYaksktXO5BGqzmOh4HnJa9iOKmXNA&quot; data-csrf=&quot;true&quot; />">
  <div
    class="search-input-container search-with-dialog position-relative d-flex flex-row flex-items-center height-auto color-bg-transparent border-0 color-fg-subtle mx-0"
    data-action="click:qbsearch-input#searchInputContainerClicked"
  >
      
            <button type="button" data-action="click:qbsearch-input#handleExpand" class="AppHeader-button AppHeader-search-whenNarrow" aria-label="Search or jump to…" aria-expanded="false" aria-haspopup="dialog">
            <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-search">
    <path d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z"></path>
</svg>
          </button>


<div class="AppHeader-search-whenRegular">
  <div class="AppHeader-search-wrap AppHeader-search-wrap--hasTrailing">
    <div class="AppHeader-search-control">
      <label
        for="AppHeader-searchInput"
        aria-label="Search or jump to…"
        class="AppHeader-search-visual--leading"
      >
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-search">
    <path d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z"></path>
</svg>
      </label>

                <button
            type="button"
            data-target="qbsearch-input.inputButton"
            data-action="click:qbsearch-input#handleExpand"
            class="AppHeader-searchButton form-control input-contrast text-left color-fg-subtle no-wrap"
            data-hotkey="s,/"
            data-analytics-event="{&quot;category&quot;:&quot;Global navigation&quot;,&quot;action&quot;:&quot;SEARCH&quot;,&quot;label&quot;:null}"
            aria-describedby="search-error-message-flash"
          >
            <div class="overflow-hidden">
              <span id="qb-input-query" data-target="qbsearch-input.inputButtonText">
                  Type <kbd class="AppHeader-search-kbd">/</kbd> to search
              </span>
            </div>
          </button>

    </div>


      <button type="button" id="AppHeader-commandPalette-button" class="AppHeader-search-action--trailing js-activate-command-palette" data-analytics-event="{&quot;category&quot;:&quot;SiteHeaderComponent&quot;,&quot;action&quot;:&quot;command_palette&quot;,&quot;label&quot;:&quot;open command palette&quot;}">
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-command-palette">
    <path d="m6.354 8.04-4.773 4.773a.75.75 0 1 0 1.061 1.06L7.945 8.57a.75.75 0 0 0 0-1.06L2.642 2.206a.75.75 0 0 0-1.06 1.061L6.353 8.04ZM8.75 11.5a.75.75 0 0 0 0 1.5h5.5a.75.75 0 0 0 0-1.5h-5.5Z"></path>
</svg>
      </button>

      <tool-tip id="tooltip-4838e11b-4c8a-4531-8467-9f749d8ea320" for="AppHeader-commandPalette-button" popover="manual" data-direction="s" data-type="label" data-view-component="true" class="sr-only position-absolute">Command palette</tool-tip>
  </div>
</div>

    <input type="hidden" name="type" class="js-site-search-type-field">

    
<div class="Overlay--hidden " data-modal-dialog-overlay>
  <modal-dialog data-action="close:qbsearch-input#handleClose cancel:qbsearch-input#handleClose" data-target="qbsearch-input.searchSuggestionsDialog" role="dialog" id="search-suggestions-dialog" aria-modal="true" aria-labelledby="search-suggestions-dialog-header" data-view-component="true" class="Overlay Overlay--width-medium Overlay--height-auto">
      <h1 id="search-suggestions-dialog-header" class="sr-only">Search code, repositories, users, issues, pull requests...</h1>
    <div class="Overlay-body Overlay-body--paddingNone">
      
          <div data-view-component="true">        <div class="search-suggestions position-absolute width-full color-shadow-large border color-fg-default color-bg-default overflow-hidden d-flex flex-column query-builder-container"
          style="border-radius: 12px;"
          data-target="qbsearch-input.queryBuilderContainer"
          hidden
        >
          <!-- '"\` --><!-- </textarea></xmp> --></option></form><form id="query-builder-test-form" action="" accept-charset="UTF-8" method="get">
  <query-builder data-target="qbsearch-input.queryBuilder" id="query-builder-query-builder-test" data-filter-key=":" data-view-component="true" class="QueryBuilder search-query-builder">
    <div class="FormControl FormControl--fullWidth">
      <label id="query-builder-test-label" for="query-builder-test" class="FormControl-label sr-only">
        Search
      </label>
      <div
        class="QueryBuilder-StyledInput width-fit "
        data-target="query-builder.styledInput"
      >
          <span id="query-builder-test-leadingvisual-wrap" class="FormControl-input-leadingVisualWrap QueryBuilder-leadingVisualWrap">
            <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-search FormControl-input-leadingVisual">
    <path d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z"></path>
</svg>
          </span>
        <div data-target="query-builder.styledInputContainer" class="QueryBuilder-StyledInputContainer">
          <div
            aria-hidden="true"
            class="QueryBuilder-StyledInputContent"
            data-target="query-builder.styledInputContent"
          ></div>
          <div class="QueryBuilder-InputWrapper">
            <div aria-hidden="true" class="QueryBuilder-Sizer" data-target="query-builder.sizer"></div>
            <input id="query-builder-test" name="query-builder-test" value="" autocomplete="off" type="text" role="combobox" spellcheck="false" aria-expanded="false" aria-describedby="validation-23838f38-756e-41cb-ab05-648f1d192401" data-target="query-builder.input" data-action="
          input:query-builder#inputChange
          blur:query-builder#inputBlur
          keydown:query-builder#inputKeydown
          focus:query-builder#inputFocus
        " data-view-component="true" class="FormControl-input QueryBuilder-Input FormControl-medium" />
          </div>
        </div>
          <span class="sr-only" id="query-builder-test-clear">Clear</span>
          <button role="button" id="query-builder-test-clear-button" aria-labelledby="query-builder-test-clear query-builder-test-label" data-target="query-builder.clearButton" data-action="
                click:query-builder#clear
                focus:query-builder#clearButtonFocus
                blur:query-builder#clearButtonBlur
              " variant="small" hidden="hidden" type="button" data-view-component="true" class="Button Button--iconOnly Button--invisible Button--medium mr-1 px-2 py-0 d-flex flex-items-center rounded-1 color-fg-muted">  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-x-circle-fill Button-visual">
    <path d="M2.343 13.657A8 8 0 1 1 13.658 2.343 8 8 0 0 1 2.343 13.657ZM6.03 4.97a.751.751 0 0 0-1.042.018.751.751 0 0 0-.018 1.042L6.94 8 4.97 9.97a.749.749 0 0 0 .326 1.275.749.749 0 0 0 .734-.215L8 9.06l1.97 1.97a.749.749 0 0 0 1.275-.326.749.749 0 0 0-.215-.734L9.06 8l1.97-1.97a.749.749 0 0 0-.326-1.275.749.749 0 0 0-.734.215L8 6.94Z"></path>
</svg>
</button>

      </div>
      <template id="search-icon">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-search">
    <path d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z"></path>
</svg>
</template>

<template id="code-icon">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-code">
    <path d="m11.28 3.22 4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L13.94 8l-3.72-3.72a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215Zm-6.56 0a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L2.06 8l3.72 3.72a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L.47 8.53a.75.75 0 0 1 0-1.06Z"></path>
</svg>
</template>

<template id="file-code-icon">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-file-code">
    <path d="M4 1.75C4 .784 4.784 0 5.75 0h5.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v8.586A1.75 1.75 0 0 1 14.25 15h-9a.75.75 0 0 1 0-1.5h9a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 10 4.25V1.5H5.75a.25.25 0 0 0-.25.25v2.5a.75.75 0 0 1-1.5 0Zm1.72 4.97a.75.75 0 0 1 1.06 0l2 2a.75.75 0 0 1 0 1.06l-2 2a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l1.47-1.47-1.47-1.47a.75.75 0 0 1 0-1.06ZM3.28 7.78 1.81 9.25l1.47 1.47a.751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018l-2-2a.75.75 0 0 1 0-1.06l2-2a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Zm8.22-6.218V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z"></path>
</svg>
</template>

<template id="history-icon">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-history">
    <path d="m.427 1.927 1.215 1.215a8.002 8.002 0 1 1-1.6 5.685.75.75 0 1 1 1.493-.154 6.5 6.5 0 1 0 1.18-4.458l1.358 1.358A.25.25 0 0 1 3.896 6H.25A.25.25 0 0 1 0 5.75V2.104a.25.25 0 0 1 .427-.177ZM7.75 4a.75.75 0 0 1 .75.75v2.992l2.028.812a.75.75 0 0 1-.557 1.392l-2.5-1A.751.751 0 0 1 7 8.25v-3.5A.75.75 0 0 1 7.75 4Z"></path>
</svg>
</template>

<template id="repo-icon">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-repo">
    <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z"></path>
</svg>
</template>

<template id="bookmark-icon">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-bookmark">
    <path d="M3 2.75C3 1.784 3.784 1 4.75 1h6.5c.966 0 1.75.784 1.75 1.75v11.5a.75.75 0 0 1-1.227.579L8 11.722l-3.773 3.107A.751.751 0 0 1 3 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.91l3.023-2.489a.75.75 0 0 1 .954 0l3.023 2.49V2.75a.25.25 0 0 0-.25-.25Z"></path>
</svg>
</template>

<template id="plus-circle-icon">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-plus-circle">
    <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7.25-3.25v2.5h2.5a.75.75 0 0 1 0 1.5h-2.5v2.5a.75.75 0 0 1-1.5 0v-2.5h-2.5a.75.75 0 0 1 0-1.5h2.5v-2.5a.75.75 0 0 1 1.5 0Z"></path>
</svg>
</template>

<template id="circle-icon">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-dot-fill">
    <path d="M8 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z"></path>
</svg>
</template>

<template id="trash-icon">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-trash">
    <path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.575l-.66-6.6a.75.75 0 1 1 1.492-.15ZM6.5 1.75V3h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25Z"></path>
</svg>
</template>

<template id="team-icon">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-people">
    <path d="M2 5.5a3.5 3.5 0 1 1 5.898 2.549 5.508 5.508 0 0 1 3.034 4.084.75.75 0 1 1-1.482.235 4 4 0 0 0-7.9 0 .75.75 0 0 1-1.482-.236A5.507 5.507 0 0 1 3.102 8.05 3.493 3.493 0 0 1 2 5.5ZM11 4a3.001 3.001 0 0 1 2.22 5.018 5.01 5.01 0 0 1 2.56 3.012.749.749 0 0 1-.885.954.752.752 0 0 1-.549-.514 3.507 3.507 0 0 0-2.522-2.372.75.75 0 0 1-.574-.73v-.352a.75.75 0 0 1 .416-.672A1.5 1.5 0 0 0 11 5.5.75.75 0 0 1 11 4Zm-5.5-.5a2 2 0 1 0-.001 3.999A2 2 0 0 0 5.5 3.5Z"></path>
</svg>
</template>

<template id="project-icon">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-project">
    <path d="M1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25V1.75C0 .784.784 0 1.75 0ZM1.5 1.75v12.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25H1.75a.25.25 0 0 0-.25.25ZM11.75 3a.75.75 0 0 1 .75.75v7.5a.75.75 0 0 1-1.5 0v-7.5a.75.75 0 0 1 .75-.75Zm-8.25.75a.75.75 0 0 1 1.5 0v5.5a.75.75 0 0 1-1.5 0ZM8 3a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 3Z"></path>
</svg>
</template>

<template id="pencil-icon">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-pencil">
    <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Zm.176 4.823L9.75 4.81l-6.286 6.287a.253.253 0 0 0-.064.108l-.558 1.953 1.953-.558a.253.253 0 0 0 .108-.064Zm1.238-3.763a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354Z"></path>
</svg>
</template>

<template id="copilot-icon">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-copilot">
    <path d="M7.998 15.035c-4.562 0-7.873-2.914-7.998-3.749V9.338c.085-.628.677-1.686 1.588-2.065.013-.07.024-.143.036-.218.029-.183.06-.384.126-.612-.201-.508-.254-1.084-.254-1.656 0-.87.128-1.769.693-2.484.579-.733 1.494-1.124 2.724-1.261 1.206-.134 2.262.034 2.944.765.05.053.096.108.139.165.044-.057.094-.112.143-.165.682-.731 1.738-.899 2.944-.765 1.23.137 2.145.528 2.724 1.261.566.715.693 1.614.693 2.484 0 .572-.053 1.148-.254 1.656.066.228.098.429.126.612.012.076.024.148.037.218.924.385 1.522 1.471 1.591 2.095v1.872c0 .766-3.351 3.795-8.002 3.795Zm0-1.485c2.28 0 4.584-1.11 5.002-1.433V7.862l-.023-.116c-.49.21-1.075.291-1.727.291-1.146 0-2.059-.327-2.71-.991A3.222 3.222 0 0 1 8 6.303a3.24 3.24 0 0 1-.544.743c-.65.664-1.563.991-2.71.991-.652 0-1.236-.081-1.727-.291l-.023.116v4.255c.419.323 2.722 1.433 5.002 1.433ZM6.762 2.83c-.193-.206-.637-.413-1.682-.297-1.019.113-1.479.404-1.713.7-.247.312-.369.789-.369 1.554 0 .793.129 1.171.308 1.371.162.181.519.379 1.442.379.853 0 1.339-.235 1.638-.54.315-.322.527-.827.617-1.553.117-.935-.037-1.395-.241-1.614Zm4.155-.297c-1.044-.116-1.488.091-1.681.297-.204.219-.359.679-.242 1.614.091.726.303 1.231.618 1.553.299.305.784.54 1.638.54.922 0 1.28-.198 1.442-.379.179-.2.308-.578.308-1.371 0-.765-.123-1.242-.37-1.554-.233-.296-.693-.587-1.713-.7Z"></path><path d="M6.25 9.037a.75.75 0 0 1 .75.75v1.501a.75.75 0 0 1-1.5 0V9.787a.75.75 0 0 1 .75-.75Zm4.25.75v1.501a.75.75 0 0 1-1.5 0V9.787a.75.75 0 0 1 1.5 0Z"></path>
</svg>
</template>

<template id="workflow-icon">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-workflow">
    <path d="M0 1.75C0 .784.784 0 1.75 0h3.5C6.216 0 7 .784 7 1.75v3.5A1.75 1.75 0 0 1 5.25 7H4v4a1 1 0 0 0 1 1h4v-1.25C9 9.784 9.784 9 10.75 9h3.5c.966 0 1.75.784 1.75 1.75v3.5A1.75 1.75 0 0 1 14.25 16h-3.5A1.75 1.75 0 0 1 9 14.25v-.75H5A2.5 2.5 0 0 1 2.5 11V7h-.75A1.75 1.75 0 0 1 0 5.25Zm1.75-.25a.25.25 0 0 0-.25.25v3.5c0 .138.112.25.25.25h3.5a.25.25 0 0 0 .25-.25v-3.5a.25.25 0 0 0-.25-.25Zm9 9a.25.25 0 0 0-.25.25v3.5c0 .138.112.25.25.25h3.5a.25.25 0 0 0 .25-.25v-3.5a.25.25 0 0 0-.25-.25Z"></path>
</svg>
</template>

<template id="book-icon">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-book">
    <path d="M0 1.75A.75.75 0 0 1 .75 1h4.253c1.227 0 2.317.59 3 1.501A3.743 3.743 0 0 1 11.006 1h4.245a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75h-4.507a2.25 2.25 0 0 0-1.591.659l-.622.621a.75.75 0 0 1-1.06 0l-.622-.621A2.25 2.25 0 0 0 5.258 13H.75a.75.75 0 0 1-.75-.75Zm7.251 10.324.004-5.073-.002-2.253A2.25 2.25 0 0 0 5.003 2.5H1.5v9h3.757a3.75 3.75 0 0 1 1.994.574ZM8.755 4.75l-.004 7.322a3.752 3.752 0 0 1 1.992-.572H14.5v-9h-3.495a2.25 2.25 0 0 0-2.25 2.25Z"></path>
</svg>
</template>

<template id="code-review-icon">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-code-review">
    <path d="M1.75 1h12.5c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0 1 14.25 13H8.061l-2.574 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25v-8.5C0 1.784.784 1 1.75 1ZM1.5 2.75v8.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-8.5a.25.25 0 0 0-.25-.25H1.75a.25.25 0 0 0-.25.25Zm5.28 1.72a.75.75 0 0 1 0 1.06L5.31 7l1.47 1.47a.751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018l-2-2a.75.75 0 0 1 0-1.06l2-2a.75.75 0 0 1 1.06 0Zm2.44 0a.75.75 0 0 1 1.06 0l2 2a.75.75 0 0 1 0 1.06l-2 2a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L10.69 7 9.22 5.53a.75.75 0 0 1 0-1.06Z"></path>
</svg>
</template>

<template id="codespaces-icon">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-codespaces">
    <path d="M0 11.25c0-.966.784-1.75 1.75-1.75h12.5c.966 0 1.75.784 1.75 1.75v3A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25Zm2-9.5C2 .784 2.784 0 3.75 0h8.5C13.216 0 14 .784 14 1.75v5a1.75 1.75 0 0 1-1.75 1.75h-8.5A1.75 1.75 0 0 1 2 6.75Zm1.75-.25a.25.25 0 0 0-.25.25v5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-5a.25.25 0 0 0-.25-.25Zm-2 9.5a.25.25 0 0 0-.25.25v3c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25v-3a.25.25 0 0 0-.25-.25Z"></path><path d="M7 12.75a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1-.75-.75Zm-4 0a.75.75 0 0 1 .75-.75h.5a.75.75 0 0 1 0 1.5h-.5a.75.75 0 0 1-.75-.75Z"></path>
</svg>
</template>

<template id="comment-icon">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-comment">
    <path d="M1 2.75C1 1.784 1.784 1 2.75 1h10.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0 1 13.25 12H9.06l-2.573 2.573A1.458 1.458 0 0 1 4 13.543V12H2.75A1.75 1.75 0 0 1 1 10.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h4.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path>
</svg>
</template>

<template id="comment-discussion-icon">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-comment-discussion">
    <path d="M1.75 1h8.5c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 10.25 10H7.061l-2.574 2.573A1.458 1.458 0 0 1 2 11.543V10h-.25A1.75 1.75 0 0 1 0 8.25v-5.5C0 1.784.784 1 1.75 1ZM1.5 2.75v5.5c0 .138.112.25.25.25h1a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h3.5a.25.25 0 0 0 .25-.25v-5.5a.25.25 0 0 0-.25-.25h-8.5a.25.25 0 0 0-.25.25Zm13 2a.25.25 0 0 0-.25-.25h-.5a.75.75 0 0 1 0-1.5h.5c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 14.25 12H14v1.543a1.458 1.458 0 0 1-2.487 1.03L9.22 12.28a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215l2.22 2.22v-2.19a.75.75 0 0 1 .75-.75h1a.25.25 0 0 0 .25-.25Z"></path>
</svg>
</template>

<template id="organization-icon">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-organization">
    <path d="M1.75 16A1.75 1.75 0 0 1 0 14.25V1.75C0 .784.784 0 1.75 0h8.5C11.216 0 12 .784 12 1.75v12.5c0 .085-.006.168-.018.25h2.268a.25.25 0 0 0 .25-.25V8.285a.25.25 0 0 0-.111-.208l-1.055-.703a.749.749 0 1 1 .832-1.248l1.055.703c.487.325.779.871.779 1.456v5.965A1.75 1.75 0 0 1 14.25 16h-3.5a.766.766 0 0 1-.197-.026c-.099.017-.2.026-.303.026h-3a.75.75 0 0 1-.75-.75V14h-1v1.25a.75.75 0 0 1-.75.75Zm-.25-1.75c0 .138.112.25.25.25H4v-1.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 .75.75v1.25h2.25a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25h-8.5a.25.25 0 0 0-.25.25ZM3.75 6h.5a.75.75 0 0 1 0 1.5h-.5a.75.75 0 0 1 0-1.5ZM3 3.75A.75.75 0 0 1 3.75 3h.5a.75.75 0 0 1 0 1.5h-.5A.75.75 0 0 1 3 3.75Zm4 3A.75.75 0 0 1 7.75 6h.5a.75.75 0 0 1 0 1.5h-.5A.75.75 0 0 1 7 6.75ZM7.75 3h.5a.75.75 0 0 1 0 1.5h-.5a.75.75 0 0 1 0-1.5ZM3 9.75A.75.75 0 0 1 3.75 9h.5a.75.75 0 0 1 0 1.5h-.5A.75.75 0 0 1 3 9.75ZM7.75 9h.5a.75.75 0 0 1 0 1.5h-.5a.75.75 0 0 1 0-1.5Z"></path>
</svg>
</template>

<template id="rocket-icon">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-rocket">
    <path d="M14.064 0h.186C15.216 0 16 .784 16 1.75v.186a8.752 8.752 0 0 1-2.564 6.186l-.458.459c-.314.314-.641.616-.979.904v3.207c0 .608-.315 1.172-.833 1.49l-2.774 1.707a.749.749 0 0 1-1.11-.418l-.954-3.102a1.214 1.214 0 0 1-.145-.125L3.754 9.816a1.218 1.218 0 0 1-.124-.145L.528 8.717a.749.749 0 0 1-.418-1.11l1.71-2.774A1.748 1.748 0 0 1 3.31 4h3.204c.288-.338.59-.665.904-.979l.459-.458A8.749 8.749 0 0 1 14.064 0ZM8.938 3.623h-.002l-.458.458c-.76.76-1.437 1.598-2.02 2.5l-1.5 2.317 2.143 2.143 2.317-1.5c.902-.583 1.74-1.26 2.499-2.02l.459-.458a7.25 7.25 0 0 0 2.123-5.127V1.75a.25.25 0 0 0-.25-.25h-.186a7.249 7.249 0 0 0-5.125 2.123ZM3.56 14.56c-.732.732-2.334 1.045-3.005 1.148a.234.234 0 0 1-.201-.064.234.234 0 0 1-.064-.201c.103-.671.416-2.273 1.15-3.003a1.502 1.502 0 1 1 2.12 2.12Zm6.94-3.935c-.088.06-.177.118-.266.175l-2.35 1.521.548 1.783 1.949-1.2a.25.25 0 0 0 .119-.213ZM3.678 8.116 5.2 5.766c.058-.09.117-.178.176-.266H3.309a.25.25 0 0 0-.213.119l-1.2 1.95ZM12 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"></path>
</svg>
</template>

<template id="shield-check-icon">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-shield-check">
    <path d="m8.533.133 5.25 1.68A1.75 1.75 0 0 1 15 3.48V7c0 1.566-.32 3.182-1.303 4.682-.983 1.498-2.585 2.813-5.032 3.855a1.697 1.697 0 0 1-1.33 0c-2.447-1.042-4.049-2.357-5.032-3.855C1.32 10.182 1 8.566 1 7V3.48a1.75 1.75 0 0 1 1.217-1.667l5.25-1.68a1.748 1.748 0 0 1 1.066 0Zm-.61 1.429.001.001-5.25 1.68a.251.251 0 0 0-.174.237V7c0 1.36.275 2.666 1.057 3.859.784 1.194 2.121 2.342 4.366 3.298a.196.196 0 0 0 .154 0c2.245-.957 3.582-2.103 4.366-3.297C13.225 9.666 13.5 8.358 13.5 7V3.48a.25.25 0 0 0-.174-.238l-5.25-1.68a.25.25 0 0 0-.153 0ZM11.28 6.28l-3.5 3.5a.75.75 0 0 1-1.06 0l-1.5-1.5a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215l.97.97 2.97-2.97a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z"></path>
</svg>
</template>

<template id="heart-icon">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-heart">
    <path d="m8 14.25.345.666a.75.75 0 0 1-.69 0l-.008-.004-.018-.01a7.152 7.152 0 0 1-.31-.17 22.055 22.055 0 0 1-3.434-2.414C2.045 10.731 0 8.35 0 5.5 0 2.836 2.086 1 4.25 1 5.797 1 7.153 1.802 8 3.02 8.847 1.802 10.203 1 11.75 1 13.914 1 16 2.836 16 5.5c0 2.85-2.045 5.231-3.885 6.818a22.066 22.066 0 0 1-3.744 2.584l-.018.01-.006.003h-.002ZM4.25 2.5c-1.336 0-2.75 1.164-2.75 3 0 2.15 1.58 4.144 3.365 5.682A20.58 20.58 0 0 0 8 13.393a20.58 20.58 0 0 0 3.135-2.211C12.92 9.644 14.5 7.65 14.5 5.5c0-1.836-1.414-3-2.75-3-1.373 0-2.609.986-3.029 2.456a.749.749 0 0 1-1.442 0C6.859 3.486 5.623 2.5 4.25 2.5Z"></path>
</svg>
</template>

<template id="server-icon">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-server">
    <path d="M1.75 1h12.5c.966 0 1.75.784 1.75 1.75v4c0 .372-.116.717-.314 1 .198.283.314.628.314 1v4a1.75 1.75 0 0 1-1.75 1.75H1.75A1.75 1.75 0 0 1 0 12.75v-4c0-.358.109-.707.314-1a1.739 1.739 0 0 1-.314-1v-4C0 1.784.784 1 1.75 1ZM1.5 2.75v4c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25v-4a.25.25 0 0 0-.25-.25H1.75a.25.25 0 0 0-.25.25Zm.25 5.75a.25.25 0 0 0-.25.25v4c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25v-4a.25.25 0 0 0-.25-.25ZM7 4.75A.75.75 0 0 1 7.75 4h4.5a.75.75 0 0 1 0 1.5h-4.5A.75.75 0 0 1 7 4.75ZM7.75 10h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM3 4.75A.75.75 0 0 1 3.75 4h.5a.75.75 0 0 1 0 1.5h-.5A.75.75 0 0 1 3 4.75ZM3.75 10h.5a.75.75 0 0 1 0 1.5h-.5a.75.75 0 0 1 0-1.5Z"></path>
</svg>
</template>

<template id="globe-icon">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-globe">
    <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM5.78 8.75a9.64 9.64 0 0 0 1.363 4.177c.255.426.542.832.857 1.215.245-.296.551-.705.857-1.215A9.64 9.64 0 0 0 10.22 8.75Zm4.44-1.5a9.64 9.64 0 0 0-1.363-4.177c-.307-.51-.612-.919-.857-1.215a9.927 9.927 0 0 0-.857 1.215A9.64 9.64 0 0 0 5.78 7.25Zm-5.944 1.5H1.543a6.507 6.507 0 0 0 4.666 5.5c-.123-.181-.24-.365-.352-.552-.715-1.192-1.437-2.874-1.581-4.948Zm-2.733-1.5h2.733c.144-2.074.866-3.756 1.58-4.948.12-.197.237-.381.353-.552a6.507 6.507 0 0 0-4.666 5.5Zm10.181 1.5c-.144 2.074-.866 3.756-1.58 4.948-.12.197-.237.381-.353.552a6.507 6.507 0 0 0 4.666-5.5Zm2.733-1.5a6.507 6.507 0 0 0-4.666-5.5c.123.181.24.365.353.552.714 1.192 1.436 2.874 1.58 4.948Z"></path>
</svg>
</template>

<template id="issue-opened-icon">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-issue-opened">
    <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"></path><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"></path>
</svg>
</template>

<template id="device-mobile-icon">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-device-mobile">
    <path d="M3.75 0h8.5C13.216 0 14 .784 14 1.75v12.5A1.75 1.75 0 0 1 12.25 16h-8.5A1.75 1.75 0 0 1 2 14.25V1.75C2 .784 2.784 0 3.75 0ZM3.5 1.75v12.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25h-8.5a.25.25 0 0 0-.25.25ZM8 13a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path>
</svg>
</template>

<template id="package-icon">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-package">
    <path d="m8.878.392 5.25 3.045c.54.314.872.89.872 1.514v6.098a1.75 1.75 0 0 1-.872 1.514l-5.25 3.045a1.75 1.75 0 0 1-1.756 0l-5.25-3.045A1.75 1.75 0 0 1 1 11.049V4.951c0-.624.332-1.201.872-1.514L7.122.392a1.75 1.75 0 0 1 1.756 0ZM7.875 1.69l-4.63 2.685L8 7.133l4.755-2.758-4.63-2.685a.248.248 0 0 0-.25 0ZM2.5 5.677v5.372c0 .09.047.171.125.216l4.625 2.683V8.432Zm6.25 8.271 4.625-2.683a.25.25 0 0 0 .125-.216V5.677L8.75 8.432Z"></path>
</svg>
</template>

<template id="credit-card-icon">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-credit-card">
    <path d="M10.75 9a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5h-1.5Z"></path><path d="M0 3.75C0 2.784.784 2 1.75 2h12.5c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0 1 14.25 14H1.75A1.75 1.75 0 0 1 0 12.25ZM14.5 6.5h-13v5.75c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25Zm0-2.75a.25.25 0 0 0-.25-.25H1.75a.25.25 0 0 0-.25.25V5h13Z"></path>
</svg>
</template>

<template id="play-icon">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-play">
    <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm4.879-2.773 4.264 2.559a.25.25 0 0 1 0 .428l-4.264 2.559A.25.25 0 0 1 6 10.559V5.442a.25.25 0 0 1 .379-.215Z"></path>
</svg>
</template>

<template id="gift-icon">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-gift">
    <path d="M2 2.75A2.75 2.75 0 0 1 4.75 0c.983 0 1.873.42 2.57 1.232.268.318.497.668.68 1.042.183-.375.411-.725.68-1.044C9.376.42 10.266 0 11.25 0a2.75 2.75 0 0 1 2.45 4h.55c.966 0 1.75.784 1.75 1.75v2c0 .698-.409 1.301-1 1.582v4.918A1.75 1.75 0 0 1 13.25 16H2.75A1.75 1.75 0 0 1 1 14.25V9.332C.409 9.05 0 8.448 0 7.75v-2C0 4.784.784 4 1.75 4h.55c-.192-.375-.3-.8-.3-1.25ZM7.25 9.5H2.5v4.75c0 .138.112.25.25.25h4.5Zm1.5 0v5h4.5a.25.25 0 0 0 .25-.25V9.5Zm0-4V8h5.5a.25.25 0 0 0 .25-.25v-2a.25.25 0 0 0-.25-.25Zm-7 0a.25.25 0 0 0-.25.25v2c0 .138.112.25.25.25h5.5V5.5h-5.5Zm3-4a1.25 1.25 0 0 0 0 2.5h2.309c-.233-.818-.542-1.401-.878-1.793-.43-.502-.915-.707-1.431-.707ZM8.941 4h2.309a1.25 1.25 0 0 0 0-2.5c-.516 0-1 .205-1.43.707-.337.392-.646.975-.879 1.793Z"></path>
</svg>
</template>

<template id="code-square-icon">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-code-square">
    <path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25Zm7.47 3.97a.75.75 0 0 1 1.06 0l2 2a.75.75 0 0 1 0 1.06l-2 2a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L10.69 8 9.22 6.53a.75.75 0 0 1 0-1.06ZM6.78 6.53 5.31 8l1.47 1.47a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215l-2-2a.75.75 0 0 1 0-1.06l2-2a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z"></path>
</svg>
</template>

<template id="device-desktop-icon">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-device-desktop">
    <path d="M14.25 1c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0 1 14.25 12h-3.727c.099 1.041.52 1.872 1.292 2.757A.752.752 0 0 1 11.25 16h-6.5a.75.75 0 0 1-.565-1.243c.772-.885 1.192-1.716 1.292-2.757H1.75A1.75 1.75 0 0 1 0 10.25v-7.5C0 1.784.784 1 1.75 1ZM1.75 2.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25ZM9.018 12H6.982a5.72 5.72 0 0 1-.765 2.5h3.566a5.72 5.72 0 0 1-.765-2.5Z"></path>
</svg>
</template>

        <div class="position-relative">
                <ul
                  role="listbox"
                  class="ActionListWrap QueryBuilder-ListWrap"
                  aria-label="Suggestions"
                  data-action="
                    combobox-commit:query-builder#comboboxCommit
                    mousedown:query-builder#resultsMousedown
                  "
                  data-target="query-builder.resultsList"
                  data-persist-list=false
                  id="query-builder-test-results"
                ></ul>
        </div>
      <div class="FormControl-inlineValidation" id="validation-23838f38-756e-41cb-ab05-648f1d192401" hidden="hidden">
        <span class="FormControl-inlineValidation--visual">
          <svg aria-hidden="true" height="12" viewBox="0 0 12 12" version="1.1" width="12" data-view-component="true" class="octicon octicon-alert-fill">
    <path d="M4.855.708c.5-.896 1.79-.896 2.29 0l4.675 8.351a1.312 1.312 0 0 1-1.146 1.954H1.33A1.313 1.313 0 0 1 .183 9.058ZM7 7V3H5v4Zm-1 3a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"></path>
</svg>
        </span>
        <span></span>
</div>    </div>
    <div data-target="query-builder.screenReaderFeedback" aria-live="polite" aria-atomic="true" class="sr-only"></div>
</query-builder></form>
          <div class="d-flex flex-row color-fg-muted px-3 text-small color-bg-default search-feedback-prompt">
            <a target="_blank" href="https://docs.github.com/search-github/github-code-search/understanding-github-code-search-syntax" data-view-component="true" class="Link color-fg-accent text-normal ml-2">
              Search syntax tips
</a>            <div class="d-flex flex-1"></div>
              <button data-action="click:qbsearch-input#showFeedbackDialog" type="button" data-view-component="true" class="Button--link Button--medium Button color-fg-accent text-normal ml-2">  <span class="Button-content">
    <span class="Button-label">Give feedback</span>
  </span>
</button>
          </div>
        </div>
</div>

    </div>
</modal-dialog></div>
  </div>
  <div data-action="click:qbsearch-input#retract" class="dark-backdrop position-fixed" hidden data-target="qbsearch-input.darkBackdrop"></div>
  <div class="color-fg-default">
    
<dialog-helper>
  <dialog data-target="qbsearch-input.feedbackDialog" data-action="close:qbsearch-input#handleDialogClose cancel:qbsearch-input#handleDialogClose" id="feedback-dialog" aria-modal="true" aria-labelledby="feedback-dialog-title" aria-describedby="feedback-dialog-description" data-view-component="true" class="Overlay Overlay-whenNarrow Overlay--size-medium Overlay--motion-scaleFade">
    <div data-view-component="true" class="Overlay-header">
  <div class="Overlay-headerContentWrap">
    <div class="Overlay-titleWrap">
      <h1 class="Overlay-title " id="feedback-dialog-title">
        Provide feedback
      </h1>
    </div>
    <div class="Overlay-actionWrap">
      <button data-close-dialog-id="feedback-dialog" aria-label="Close" type="button" data-view-component="true" class="close-button Overlay-closeButton"><svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-x">
    <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path>
</svg></button>
    </div>
  </div>
</div>
      <scrollable-region data-labelled-by="feedback-dialog-title">
        <div data-view-component="true" class="Overlay-body">        <!-- '"\` --><!-- </textarea></xmp> --></option></form><form id="code-search-feedback-form" data-turbo="false" action="/search/feedback" accept-charset="UTF-8" method="post"><input type="hidden" name="authenticity_token" value="RmLry37AnvsGEmZ12c92KZDBgvw4K_rHBnz_1sU81_lSxIBd_NMy9PtyCHQwPaYp22LRuWLLReAIuu9MvOLU1g" />
          <p>We read every piece of feedback, and take your input very seriously.</p>
          <textarea name="feedback" class="form-control width-full mb-2" style="height: 120px" id="feedback"></textarea>
          <input name="include_email" id="include_email" aria-label="Include my email address so I can be contacted" class="form-control mr-2" type="checkbox">
          <label for="include_email" style="font-weight: normal">Include my email address so I can be contacted</label>
</form></div>
      </scrollable-region>
      <div data-view-component="true" class="Overlay-footer Overlay-footer--alignEnd">          <button data-close-dialog-id="feedback-dialog" type="button" data-view-component="true" class="btn">    Cancel
</button>
          <button form="code-search-feedback-form" data-action="click:qbsearch-input#submitFeedback" type="submit" data-view-component="true" class="btn-primary btn">    Submit feedback
</button>
</div>
</dialog></dialog-helper>

    <custom-scopes data-target="qbsearch-input.customScopesManager">
    
<dialog-helper>
  <dialog data-target="custom-scopes.customScopesModalDialog" data-action="close:qbsearch-input#handleDialogClose cancel:qbsearch-input#handleDialogClose" id="custom-scopes-dialog" aria-modal="true" aria-labelledby="custom-scopes-dialog-title" aria-describedby="custom-scopes-dialog-description" data-view-component="true" class="Overlay Overlay-whenNarrow Overlay--size-medium Overlay--motion-scaleFade">
    <div data-view-component="true" class="Overlay-header Overlay-header--divided">
  <div class="Overlay-headerContentWrap">
    <div class="Overlay-titleWrap">
      <h1 class="Overlay-title " id="custom-scopes-dialog-title">
        Saved searches
      </h1>
        <h2 id="custom-scopes-dialog-description" class="Overlay-description">Use saved searches to filter your results more quickly</h2>
    </div>
    <div class="Overlay-actionWrap">
      <button data-close-dialog-id="custom-scopes-dialog" aria-label="Close" type="button" data-view-component="true" class="close-button Overlay-closeButton"><svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-x">
    <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path>
</svg></button>
    </div>
  </div>
</div>
      <scrollable-region data-labelled-by="custom-scopes-dialog-title">
        <div data-view-component="true" class="Overlay-body">        <div data-target="custom-scopes.customScopesModalDialogFlash"></div>

        <div hidden class="create-custom-scope-form" data-target="custom-scopes.createCustomScopeForm">
        <!-- '"\` --><!-- </textarea></xmp> --></option></form><form id="custom-scopes-dialog-form" data-turbo="false" action="/search/custom_scopes" accept-charset="UTF-8" method="post"><input type="hidden" name="authenticity_token" value="Q7_3yyh8SIQxYIRY1w-DUqf2Iujv2-d6OWeVQLc433jl0CmGb5Af6jkhw6UbM6Lt1RuynokYx2QV0L5VChdzbw" />
          <div data-target="custom-scopes.customScopesModalDialogFlash"></div>

          <input type="hidden" id="custom_scope_id" name="custom_scope_id" data-target="custom-scopes.customScopesIdField">

          <div class="form-group">
            <label for="custom_scope_name">Name</label>
            <auto-check src="/search/custom_scopes/check_name" required>
              <input
                type="text"
                name="custom_scope_name"
                id="custom_scope_name"
                data-target="custom-scopes.customScopesNameField"
                class="form-control"
                autocomplete="off"
                placeholder="github-ruby"
                required
                maxlength="50">
              <input type="hidden" value="f7NBGHwpy64OvJaJNc6DPjen3ZuKhxAsafbP-w0LcG6I355hrAaEYP3LXpBpZTqgHdgv-m63Ieu7oi_RICoF-A" data-csrf="true" />
            </auto-check>
          </div>

          <div class="form-group">
            <label for="custom_scope_query">Query</label>
            <input
              type="text"
              name="custom_scope_query"
              id="custom_scope_query"
              data-target="custom-scopes.customScopesQueryField"
              class="form-control"
              autocomplete="off"
              placeholder="(repo:mona/a OR repo:mona/b) AND lang:python"
              required
              maxlength="500">
          </div>

          <p class="text-small color-fg-muted">
            To see all available qualifiers, see our <a class="Link--inTextBlock" href="https://docs.github.com/search-github/github-code-search/understanding-github-code-search-syntax">documentation</a>.
          </p>
</form>        </div>

        <div data-target="custom-scopes.manageCustomScopesForm">
          <div data-target="custom-scopes.list"></div>
        </div>

</div>
      </scrollable-region>
      <div data-view-component="true" class="Overlay-footer Overlay-footer--alignEnd Overlay-footer--divided">          <button data-action="click:custom-scopes#customScopesCancel" type="button" data-view-component="true" class="btn">    Cancel
</button>
          <button form="custom-scopes-dialog-form" data-action="click:custom-scopes#customScopesSubmit" data-target="custom-scopes.customScopesSubmitButton" type="submit" data-view-component="true" class="btn-primary btn">    Create saved search
</button>
</div>
</dialog></dialog-helper>
    </custom-scopes>
  </div>
</qbsearch-input><input type="hidden" value="TgElZ1EyAYfjbygZsMP4toP-N9_Z8AJnsh4nGj3-mXjHgEFIxQm3LbEenlZIHOL8keyKC7ADylFpkKepbuhwrA" data-csrf="true" class="js-data-jump-to-suggestions-path-csrf" />

          </div>

        <div class="AppHeader-actions position-relative">
            <action-menu data-select-variant="none" data-view-component="true">
  <focus-group direction="vertical" mnemonics retain>
    <button id="global-create-menu-button" popovertarget="global-create-menu-overlay" aria-label="Create something new" aria-controls="global-create-menu-list" aria-haspopup="true" type="button" data-view-component="true" class="AppHeader-button global-create-button Button--secondary Button--medium Button width-auto color-fg-muted">  <span class="Button-content">
      <span class="Button-visual Button-leadingVisual">
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-plus">
    <path d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z"></path>
</svg>
      </span>
    <span class="Button-label"><svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-triangle-down">
    <path d="m4.427 7.427 3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 7H4.604a.25.25 0 0 0-.177.427Z"></path>
</svg></span>
  </span>
</button><tool-tip id="tooltip-e1329144-20a9-4220-a930-7c5697e55403" for="global-create-menu-button" popover="manual" data-direction="s" data-type="description" data-view-component="true" class="sr-only position-absolute">Create new...</tool-tip>


<anchored-position id="global-create-menu-overlay" anchor="global-create-menu-button" align="end" side="outside-bottom" anchor-offset="normal" popover="auto" data-view-component="true">
  <div data-view-component="true" class="Overlay Overlay--size-auto">
    
      <div data-view-component="true" class="Overlay-body Overlay-body--paddingNone">          <action-list>
  <div data-view-component="true">
    <ul aria-labelledby="global-create-menu-button" id="global-create-menu-list" role="menu" data-view-component="true" class="ActionListWrap--inset ActionListWrap">
        <li data-analytics-event="{&quot;category&quot;:&quot;SiteHeaderComponent&quot;,&quot;action&quot;:&quot;add_dropdown&quot;,&quot;label&quot;:&quot;new repository&quot;}" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <a href="/new" tabindex="-1" id="item-eda00051-ffc8-48ae-9adb-53efb1cbcffb" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-repo">
    <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
                  New repository

</span></a>
  
  
</li>
        <li data-analytics-event="{&quot;category&quot;:&quot;SiteHeaderComponent&quot;,&quot;action&quot;:&quot;add_dropdown&quot;,&quot;label&quot;:&quot;import repository&quot;}" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <a href="/new/import" tabindex="-1" id="item-5f76d6b5-279e-4a8c-b08d-e4bb2db40052" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-repo-push">
    <path d="M1 2.5A2.5 2.5 0 0 1 3.5 0h8.75a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0V1.5h-8a1 1 0 0 0-1 1v6.708A2.493 2.493 0 0 1 3.5 9h3.25a.75.75 0 0 1 0 1.5H3.5a1 1 0 0 0 0 2h5.75a.75.75 0 0 1 0 1.5H3.5A2.5 2.5 0 0 1 1 11.5Zm13.23 7.79h-.001l-1.224-1.224v6.184a.75.75 0 0 1-1.5 0V9.066L10.28 10.29a.75.75 0 0 1-1.06-1.061l2.505-2.504a.75.75 0 0 1 1.06 0L15.29 9.23a.751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
                  Import repository

</span></a>
  
  
</li>
        <li role="presentation" aria-hidden="true" data-view-component="true" class="ActionList-sectionDivider"></li>
        <li data-analytics-event="{&quot;category&quot;:&quot;SiteHeaderComponent&quot;,&quot;action&quot;:&quot;add_dropdown&quot;,&quot;label&quot;:&quot;new codespace&quot;}" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <a href="/codespaces/new" tabindex="-1" id="item-95f279c7-43ca-4b30-b164-e1c29bb53be6" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-codespaces">
    <path d="M0 11.25c0-.966.784-1.75 1.75-1.75h12.5c.966 0 1.75.784 1.75 1.75v3A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25Zm2-9.5C2 .784 2.784 0 3.75 0h8.5C13.216 0 14 .784 14 1.75v5a1.75 1.75 0 0 1-1.75 1.75h-8.5A1.75 1.75 0 0 1 2 6.75Zm1.75-.25a.25.25 0 0 0-.25.25v5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-5a.25.25 0 0 0-.25-.25Zm-2 9.5a.25.25 0 0 0-.25.25v3c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25v-3a.25.25 0 0 0-.25-.25Z"></path><path d="M7 12.75a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1-.75-.75Zm-4 0a.75.75 0 0 1 .75-.75h.5a.75.75 0 0 1 0 1.5h-.5a.75.75 0 0 1-.75-.75Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
                  New codespace

</span></a>
  
  
</li>
        <li data-analytics-event="{&quot;category&quot;:&quot;SiteHeaderComponent&quot;,&quot;action&quot;:&quot;add_dropdown&quot;,&quot;label&quot;:&quot;new gist&quot;}" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <a href="https://gist.github.com/" tabindex="-1" id="item-713d0ce6-3b46-4393-9728-5e1fe1e535a0" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-code">
    <path d="m11.28 3.22 4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L13.94 8l-3.72-3.72a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215Zm-6.56 0a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L2.06 8l3.72 3.72a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L.47 8.53a.75.75 0 0 1 0-1.06Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
                  New gist

</span></a>
  
  
</li>
        <li role="presentation" aria-hidden="true" data-view-component="true" class="ActionList-sectionDivider"></li>
        <li data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <a href="/account/organizations/new" tabindex="-1" data-dont-follow-via-test="true" data-analytics-event="{&quot;category&quot;:&quot;SiteHeaderComponent&quot;,&quot;action&quot;:&quot;add_dropdown&quot;,&quot;label&quot;:&quot;new organization&quot;}" id="item-6cd8c168-e57b-478a-86dd-c4df05ac85a1" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-organization">
    <path d="M1.75 16A1.75 1.75 0 0 1 0 14.25V1.75C0 .784.784 0 1.75 0h8.5C11.216 0 12 .784 12 1.75v12.5c0 .085-.006.168-.018.25h2.268a.25.25 0 0 0 .25-.25V8.285a.25.25 0 0 0-.111-.208l-1.055-.703a.749.749 0 1 1 .832-1.248l1.055.703c.487.325.779.871.779 1.456v5.965A1.75 1.75 0 0 1 14.25 16h-3.5a.766.766 0 0 1-.197-.026c-.099.017-.2.026-.303.026h-3a.75.75 0 0 1-.75-.75V14h-1v1.25a.75.75 0 0 1-.75.75Zm-.25-1.75c0 .138.112.25.25.25H4v-1.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 .75.75v1.25h2.25a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25h-8.5a.25.25 0 0 0-.25.25ZM3.75 6h.5a.75.75 0 0 1 0 1.5h-.5a.75.75 0 0 1 0-1.5ZM3 3.75A.75.75 0 0 1 3.75 3h.5a.75.75 0 0 1 0 1.5h-.5A.75.75 0 0 1 3 3.75Zm4 3A.75.75 0 0 1 7.75 6h.5a.75.75 0 0 1 0 1.5h-.5A.75.75 0 0 1 7 6.75ZM7.75 3h.5a.75.75 0 0 1 0 1.5h-.5a.75.75 0 0 1 0-1.5ZM3 9.75A.75.75 0 0 1 3.75 9h.5a.75.75 0 0 1 0 1.5h-.5A.75.75 0 0 1 3 9.75ZM7.75 9h.5a.75.75 0 0 1 0 1.5h-.5a.75.75 0 0 1 0-1.5Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
                  New organization

</span></a>
  
  
</li>
</ul>    
</div></action-list>


</div>
      
</div></anchored-position>  </focus-group>
</action-menu>

          <a href="/issues" data-analytics-event="{&quot;category&quot;:&quot;Global navigation&quot;,&quot;action&quot;:&quot;ISSUES_HEADER&quot;,&quot;label&quot;:null}" id="icon-button-226f337b-b822-4755-af8b-685ea039cdc6" aria-labelledby="tooltip-1b39d307-c235-4251-8a5c-1e7ae19f5f87" data-view-component="true" class="Button Button--iconOnly Button--secondary Button--medium AppHeader-button color-fg-muted">  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-issue-opened Button-visual">
    <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"></path><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"></path>
</svg>
</a><tool-tip id="tooltip-1b39d307-c235-4251-8a5c-1e7ae19f5f87" for="icon-button-226f337b-b822-4755-af8b-685ea039cdc6" popover="manual" data-direction="s" data-type="label" data-view-component="true" class="sr-only position-absolute">Issues</tool-tip>

          <a href="/pulls" data-analytics-event="{&quot;category&quot;:&quot;Global navigation&quot;,&quot;action&quot;:&quot;PULL_REQUESTS_HEADER&quot;,&quot;label&quot;:null}" id="icon-button-6db62c00-c92e-470e-ad21-104c34a10ed7" aria-labelledby="tooltip-54fc985f-17b6-4346-b726-a3d782af8211" data-view-component="true" class="Button Button--iconOnly Button--secondary Button--medium AppHeader-button color-fg-muted">  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-git-pull-request Button-visual">
    <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z"></path>
</svg>
</a><tool-tip id="tooltip-54fc985f-17b6-4346-b726-a3d782af8211" for="icon-button-6db62c00-c92e-470e-ad21-104c34a10ed7" popover="manual" data-direction="s" data-type="label" data-view-component="true" class="sr-only position-absolute">Pull requests</tool-tip>

        </div>

        
<notification-indicator data-channel="eyJjIjoibm90aWZpY2F0aW9uLWNoYW5nZWQ6NjQ0MDgxMSIsInQiOjE3MTM2OTY0MTZ9--62f24f515bab34125fcd938e4c90dfb13aed89bcb9e4469f204bddc48620a83a" data-indicator-mode="none" data-tooltip-global="You have unread notifications" data-tooltip-unavailable="Notifications are unavailable at the moment." data-tooltip-none="You have no unread notifications" data-header-redesign-enabled="true" data-fetch-indicator-src="/notifications/indicator" data-fetch-indicator-enabled="true" data-view-component="true" class="js-socket-channel">
    <a id="AppHeader-notifications-button" href="/notifications" aria-label="Notifications" data-hotkey="g n" data-target="notification-indicator.link" data-analytics-event="{&quot;category&quot;:&quot;Global navigation&quot;,&quot;action&quot;:&quot;NOTIFICATIONS_HEADER&quot;,&quot;label&quot;:null}" data-view-component="true" class="Button Button--iconOnly Button--secondary Button--medium AppHeader-button  color-fg-muted">  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-inbox Button-visual">
    <path d="M2.8 2.06A1.75 1.75 0 0 1 4.41 1h7.18c.7 0 1.333.417 1.61 1.06l2.74 6.395c.04.093.06.194.06.295v4.5A1.75 1.75 0 0 1 14.25 15H1.75A1.75 1.75 0 0 1 0 13.25v-4.5c0-.101.02-.202.06-.295Zm1.61.44a.25.25 0 0 0-.23.152L1.887 8H4.75a.75.75 0 0 1 .6.3L6.625 10h2.75l1.275-1.7a.75.75 0 0 1 .6-.3h2.863L11.82 2.652a.25.25 0 0 0-.23-.152Zm10.09 7h-2.875l-1.275 1.7a.75.75 0 0 1-.6.3h-3.5a.75.75 0 0 1-.6-.3L4.375 9.5H1.5v3.75c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25Z"></path>
</svg>
</a>

    <tool-tip data-target="notification-indicator.tooltip" id="tooltip-2f547422-e804-4f94-92ef-41348331c43f" for="AppHeader-notifications-button" popover="manual" data-direction="s" data-type="description" data-view-component="true" class="sr-only position-absolute">Notifications</tool-tip>
</notification-indicator>

        

        <div class="AppHeader-user">
          <deferred-side-panel data-url="/_side-panels/user?react_global_nav=false&amp;repository_id=148233297">
  <include-fragment data-target="deferred-side-panel.fragment">
        <user-drawer-side-panel>
      <button aria-label="Open user account menu" data-action="click:deferred-side-panel#loadPanel click:deferred-side-panel#panelOpened" data-show-dialog-id="dialog-6cef265f-8ea1-4b14-b69e-71f5539d8267" id="dialog-show-dialog-6cef265f-8ea1-4b14-b69e-71f5539d8267" type="button" data-view-component="true" class="AppHeader-logo Button--invisible Button--medium Button Button--invisible-noVisuals color-bg-transparent p-0">  <span class="Button-content">
    <span class="Button-label"><img src="https://avatars.githubusercontent.com/u/6440811?v=4" alt="" size="32" height="32" width="32" data-view-component="true" class="avatar circle" /></span>
  </span>
</button>

<dialog-helper>
  <dialog data-target="deferred-side-panel.panel" id="dialog-6cef265f-8ea1-4b14-b69e-71f5539d8267" aria-modal="true" aria-labelledby="dialog-6cef265f-8ea1-4b14-b69e-71f5539d8267-title" aria-describedby="dialog-6cef265f-8ea1-4b14-b69e-71f5539d8267-description" data-view-component="true" class="Overlay Overlay-whenNarrow Overlay--size-small-portrait Overlay--motion-scaleFade Overlay--placement-right SidePanel">
    <div styles="flex-direction: row;" data-view-component="true" class="Overlay-header">
  <div class="Overlay-headerContentWrap">
    <div class="Overlay-titleWrap">
      <h1 class="Overlay-title sr-only" id="dialog-6cef265f-8ea1-4b14-b69e-71f5539d8267-title">
        Account menu
      </h1>
            <div data-view-component="true" class="d-flex">
      <div data-view-component="true" class="AppHeader-logo position-relative">
        <img src="https://avatars.githubusercontent.com/u/6440811?v=4" alt="" size="32" height="32" width="32" data-view-component="true" class="avatar circle" />
</div>        <div data-view-component="true" class="overflow-hidden d-flex width-full">          <div data-view-component="true" class="lh-condensed overflow-hidden d-flex flex-column flex-justify-center ml-2 f5 mr-auto width-full">
            <span data-view-component="true" class="Truncate text-bold">
    <span data-view-component="true" class="Truncate-text">
              HiromiShikata
</span>
</span>            <span data-view-component="true" class="Truncate color-fg-subtle">
    <span data-view-component="true" class="Truncate-text">
              Hiromi.s
</span>
</span></div>
            <action-menu data-select-variant="none" data-view-component="true" class="d-sm-none d-md-none d-lg-none">
  <focus-group direction="vertical" mnemonics retain>
    <button id="user-create-menu-button" popovertarget="user-create-menu-overlay" aria-label="Create something new" aria-controls="user-create-menu-list" aria-haspopup="true" type="button" data-view-component="true" class="AppHeader-button global-create-button Button--secondary Button--medium Button width-auto color-fg-muted">  <span class="Button-content">
      <span class="Button-visual Button-leadingVisual">
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-plus">
    <path d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z"></path>
</svg>
      </span>
    <span class="Button-label"><svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-triangle-down">
    <path d="m4.427 7.427 3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 7H4.604a.25.25 0 0 0-.177.427Z"></path>
</svg></span>
  </span>
</button><tool-tip id="tooltip-73e449b0-88a4-4660-8a7e-0907a16afe08" for="user-create-menu-button" popover="manual" data-direction="s" data-type="description" data-view-component="true" class="sr-only position-absolute">Create new...</tool-tip>


<anchored-position id="user-create-menu-overlay" anchor="user-create-menu-button" align="end" side="outside-bottom" anchor-offset="normal" popover="auto" data-view-component="true">
  <div data-view-component="true" class="Overlay Overlay--size-auto">
    
      <div data-view-component="true" class="Overlay-body Overlay-body--paddingNone">          <action-list>
  <div data-view-component="true">
    <ul aria-labelledby="user-create-menu-button" id="user-create-menu-list" role="menu" data-view-component="true" class="ActionListWrap--inset ActionListWrap">
        <li data-analytics-event="{&quot;category&quot;:&quot;SiteHeaderComponent&quot;,&quot;action&quot;:&quot;add_dropdown&quot;,&quot;label&quot;:&quot;new repository&quot;}" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <a href="/new" tabindex="-1" id="item-6038833f-d961-4d00-83a7-dcc9108c48ab" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-repo">
    <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
                  New repository

</span></a>
  
  
</li>
        <li data-analytics-event="{&quot;category&quot;:&quot;SiteHeaderComponent&quot;,&quot;action&quot;:&quot;add_dropdown&quot;,&quot;label&quot;:&quot;import repository&quot;}" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <a href="/new/import" tabindex="-1" id="item-bc29237d-c5e7-4511-8773-288294e1177b" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-repo-push">
    <path d="M1 2.5A2.5 2.5 0 0 1 3.5 0h8.75a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0V1.5h-8a1 1 0 0 0-1 1v6.708A2.493 2.493 0 0 1 3.5 9h3.25a.75.75 0 0 1 0 1.5H3.5a1 1 0 0 0 0 2h5.75a.75.75 0 0 1 0 1.5H3.5A2.5 2.5 0 0 1 1 11.5Zm13.23 7.79h-.001l-1.224-1.224v6.184a.75.75 0 0 1-1.5 0V9.066L10.28 10.29a.75.75 0 0 1-1.06-1.061l2.505-2.504a.75.75 0 0 1 1.06 0L15.29 9.23a.751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
                  Import repository

</span></a>
  
  
</li>
        <li role="presentation" aria-hidden="true" data-view-component="true" class="ActionList-sectionDivider"></li>
        <li data-analytics-event="{&quot;category&quot;:&quot;SiteHeaderComponent&quot;,&quot;action&quot;:&quot;add_dropdown&quot;,&quot;label&quot;:&quot;new codespace&quot;}" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <a href="/codespaces/new" tabindex="-1" id="item-a33a734e-4861-4036-84bc-cea706c9b18b" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-codespaces">
    <path d="M0 11.25c0-.966.784-1.75 1.75-1.75h12.5c.966 0 1.75.784 1.75 1.75v3A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25Zm2-9.5C2 .784 2.784 0 3.75 0h8.5C13.216 0 14 .784 14 1.75v5a1.75 1.75 0 0 1-1.75 1.75h-8.5A1.75 1.75 0 0 1 2 6.75Zm1.75-.25a.25.25 0 0 0-.25.25v5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-5a.25.25 0 0 0-.25-.25Zm-2 9.5a.25.25 0 0 0-.25.25v3c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25v-3a.25.25 0 0 0-.25-.25Z"></path><path d="M7 12.75a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1-.75-.75Zm-4 0a.75.75 0 0 1 .75-.75h.5a.75.75 0 0 1 0 1.5h-.5a.75.75 0 0 1-.75-.75Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
                  New codespace

</span></a>
  
  
</li>
        <li data-analytics-event="{&quot;category&quot;:&quot;SiteHeaderComponent&quot;,&quot;action&quot;:&quot;add_dropdown&quot;,&quot;label&quot;:&quot;new gist&quot;}" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <a href="https://gist.github.com/" tabindex="-1" id="item-67e25d27-9c63-4d3d-9e90-f4395dd74ac4" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-code">
    <path d="m11.28 3.22 4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L13.94 8l-3.72-3.72a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215Zm-6.56 0a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L2.06 8l3.72 3.72a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L.47 8.53a.75.75 0 0 1 0-1.06Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
                  New gist

</span></a>
  
  
</li>
        <li role="presentation" aria-hidden="true" data-view-component="true" class="ActionList-sectionDivider"></li>
        <li data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <a href="/account/organizations/new" tabindex="-1" data-dont-follow-via-test="true" data-analytics-event="{&quot;category&quot;:&quot;SiteHeaderComponent&quot;,&quot;action&quot;:&quot;add_dropdown&quot;,&quot;label&quot;:&quot;new organization&quot;}" id="item-a6e15481-8fbc-4079-87e8-3de4e286a8f2" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-organization">
    <path d="M1.75 16A1.75 1.75 0 0 1 0 14.25V1.75C0 .784.784 0 1.75 0h8.5C11.216 0 12 .784 12 1.75v12.5c0 .085-.006.168-.018.25h2.268a.25.25 0 0 0 .25-.25V8.285a.25.25 0 0 0-.111-.208l-1.055-.703a.749.749 0 1 1 .832-1.248l1.055.703c.487.325.779.871.779 1.456v5.965A1.75 1.75 0 0 1 14.25 16h-3.5a.766.766 0 0 1-.197-.026c-.099.017-.2.026-.303.026h-3a.75.75 0 0 1-.75-.75V14h-1v1.25a.75.75 0 0 1-.75.75Zm-.25-1.75c0 .138.112.25.25.25H4v-1.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 .75.75v1.25h2.25a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25h-8.5a.25.25 0 0 0-.25.25ZM3.75 6h.5a.75.75 0 0 1 0 1.5h-.5a.75.75 0 0 1 0-1.5ZM3 3.75A.75.75 0 0 1 3.75 3h.5a.75.75 0 0 1 0 1.5h-.5A.75.75 0 0 1 3 3.75Zm4 3A.75.75 0 0 1 7.75 6h.5a.75.75 0 0 1 0 1.5h-.5A.75.75 0 0 1 7 6.75ZM7.75 3h.5a.75.75 0 0 1 0 1.5h-.5a.75.75 0 0 1 0-1.5ZM3 9.75A.75.75 0 0 1 3.75 9h.5a.75.75 0 0 1 0 1.5h-.5A.75.75 0 0 1 3 9.75ZM7.75 9h.5a.75.75 0 0 1 0 1.5h-.5a.75.75 0 0 1 0-1.5Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
                  New organization

</span></a>
  
  
</li>
</ul>    
</div></action-list>


</div>
      
</div></anchored-position>  </focus-group>
</action-menu>
</div>
</div>
    </div>
    <div class="Overlay-actionWrap">
      <button data-close-dialog-id="dialog-6cef265f-8ea1-4b14-b69e-71f5539d8267" aria-label="Close" type="button" data-view-component="true" class="close-button Overlay-closeButton"><svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-x">
    <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path>
</svg></button>
    </div>
  </div>
</div>
      <scrollable-region data-labelled-by="dialog-6cef265f-8ea1-4b14-b69e-71f5539d8267-title">
        <div data-view-component="true" class="Overlay-body d-flex flex-column px-2">    <div data-view-component="true" class="d-flex flex-column mb-3">
        <nav aria-label="User navigation" data-view-component="true" class="ActionList">
  
  <nav-list>
    <ul data-target="nav-list.topLevelList" data-view-component="true" class="ActionListWrap">
        
          
<li data-item-id="" data-targets="nav-list.items" data-view-component="true" class="ActionListItem">
    
    <button id="item-909b0835-fa42-4255-a9d2-fd59445a29bc" type="button" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <span data-view-component="true" class="d-flex flex-items-center">    <svg style="box-sizing: content-box; color: var(--color-icon-primary);" width="16" height="16" viewBox="0 0 16 16" fill="none" data-view-component="true" class="anim-rotate">
  <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-opacity="0.25" stroke-width="2" vector-effect="non-scaling-stroke" fill="none" />
  <path d="M15 8a7.002 7.002 0 00-7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke" />
</svg>
</span>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          

  <span class="color-fg-muted">
    Loading...
  </span>

</span></button>
  
  
</li>

        
          <li role="presentation" aria-hidden="true" data-view-component="true" class="ActionList-sectionDivider"></li>
        
          
<li data-item-id="" data-targets="nav-list.items" data-view-component="true" class="ActionListItem">
    
    <a data-analytics-event="{&quot;category&quot;:&quot;Global navigation&quot;,&quot;action&quot;:&quot;PROFILE&quot;,&quot;label&quot;:null}" id="item-67877d67-e760-45df-9ab6-9c61f5a0e17d" href="https://github.com/HiromiShikata" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-person">
    <path d="M10.561 8.073a6.005 6.005 0 0 1 3.432 5.142.75.75 0 1 1-1.498.07 4.5 4.5 0 0 0-8.99 0 .75.75 0 0 1-1.498-.07 6.004 6.004 0 0 1 3.431-5.142 3.999 3.999 0 1 1 5.123 0ZM10.5 5a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Your profile
</span></a>
  
  
</li>

        
          
<li data-item-id="" data-targets="nav-list.items" data-view-component="true" class="ActionListItem">
    
    <button id="item-77148ea5-5b9d-4525-a33f-6a8b2750766e" type="button" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <span data-view-component="true" class="d-flex flex-items-center">    <svg style="box-sizing: content-box; color: var(--color-icon-primary);" width="16" height="16" viewBox="0 0 16 16" fill="none" data-view-component="true" class="anim-rotate">
  <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-opacity="0.25" stroke-width="2" vector-effect="non-scaling-stroke" fill="none" />
  <path d="M15 8a7.002 7.002 0 00-7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke" />
</svg>
</span>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          

  <span class="color-fg-muted">
    Loading...
  </span>

</span></button>
  
  
</li>

        
          <li role="presentation" aria-hidden="true" data-view-component="true" class="ActionList-sectionDivider"></li>
        
          
<li data-item-id="" data-targets="nav-list.items" data-view-component="true" class="ActionListItem">
    
    <a data-analytics-event="{&quot;category&quot;:&quot;Global navigation&quot;,&quot;action&quot;:&quot;YOUR_REPOSITORIES&quot;,&quot;label&quot;:null}" id="item-88768756-ee63-47e4-b2b9-931c518d04de" href="/HiromiShikata?tab=repositories" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-repo">
    <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Your repositories
</span></a>
  
  
</li>

        
          
<li data-item-id="" data-targets="nav-list.items" data-view-component="true" class="ActionListItem">
    
    <a data-analytics-event="{&quot;category&quot;:&quot;Global navigation&quot;,&quot;action&quot;:&quot;YOUR_PROJECTS&quot;,&quot;label&quot;:null}" id="item-075726f4-58a4-4712-8bfc-533c8a0761ee" href="/HiromiShikata?tab=projects" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-project">
    <path d="M1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25V1.75C0 .784.784 0 1.75 0ZM1.5 1.75v12.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25H1.75a.25.25 0 0 0-.25.25ZM11.75 3a.75.75 0 0 1 .75.75v7.5a.75.75 0 0 1-1.5 0v-7.5a.75.75 0 0 1 .75-.75Zm-8.25.75a.75.75 0 0 1 1.5 0v5.5a.75.75 0 0 1-1.5 0ZM8 3a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 3Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Your projects
</span></a>
  
  
</li>

        
          
<li data-item-id="" data-targets="nav-list.items" data-view-component="true" class="ActionListItem">
    
    <button id="item-c32fe8e6-072f-4bd5-9b95-12636c526b33" type="button" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <span data-view-component="true" class="d-flex flex-items-center">    <svg style="box-sizing: content-box; color: var(--color-icon-primary);" width="16" height="16" viewBox="0 0 16 16" fill="none" data-view-component="true" class="anim-rotate">
  <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-opacity="0.25" stroke-width="2" vector-effect="non-scaling-stroke" fill="none" />
  <path d="M15 8a7.002 7.002 0 00-7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke" />
</svg>
</span>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          

  <span class="color-fg-muted">
    Loading...
  </span>

</span></button>
  
  
</li>

        
          
<li data-item-id="" data-targets="nav-list.items" data-view-component="true" class="ActionListItem">
    
    <button id="item-e98d1223-4894-43ed-b4bd-e7b8e46339d2" type="button" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <span data-view-component="true" class="d-flex flex-items-center">    <svg style="box-sizing: content-box; color: var(--color-icon-primary);" width="16" height="16" viewBox="0 0 16 16" fill="none" data-view-component="true" class="anim-rotate">
  <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-opacity="0.25" stroke-width="2" vector-effect="non-scaling-stroke" fill="none" />
  <path d="M15 8a7.002 7.002 0 00-7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke" />
</svg>
</span>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          

  <span class="color-fg-muted">
    Loading...
  </span>

</span></button>
  
  
</li>

        
          
<li data-item-id="" data-targets="nav-list.items" data-view-component="true" class="ActionListItem">
    
    <a data-analytics-event="{&quot;category&quot;:&quot;Global navigation&quot;,&quot;action&quot;:&quot;YOUR_STARS&quot;,&quot;label&quot;:null}" id="item-07f6530e-acd9-4664-be2b-d189aee2b51e" href="/HiromiShikata?tab=stars" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-star">
    <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Zm0 2.445L6.615 5.5a.75.75 0 0 1-.564.41l-3.097.45 2.24 2.184a.75.75 0 0 1 .216.664l-.528 3.084 2.769-1.456a.75.75 0 0 1 .698 0l2.77 1.456-.53-3.084a.75.75 0 0 1 .216-.664l2.24-2.183-3.096-.45a.75.75 0 0 1-.564-.41L8 2.694Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Your stars
</span></a>
  
  
</li>

        
          
<li data-item-id="" data-targets="nav-list.items" data-view-component="true" class="ActionListItem">
    
    <a data-analytics-event="{&quot;category&quot;:&quot;Global navigation&quot;,&quot;action&quot;:&quot;SPONSORS&quot;,&quot;label&quot;:null}" id="item-ea53154f-2fd3-4c11-b2c0-d225ff13cd2c" href="/sponsors/accounts" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-heart">
    <path d="m8 14.25.345.666a.75.75 0 0 1-.69 0l-.008-.004-.018-.01a7.152 7.152 0 0 1-.31-.17 22.055 22.055 0 0 1-3.434-2.414C2.045 10.731 0 8.35 0 5.5 0 2.836 2.086 1 4.25 1 5.797 1 7.153 1.802 8 3.02 8.847 1.802 10.203 1 11.75 1 13.914 1 16 2.836 16 5.5c0 2.85-2.045 5.231-3.885 6.818a22.066 22.066 0 0 1-3.744 2.584l-.018.01-.006.003h-.002ZM4.25 2.5c-1.336 0-2.75 1.164-2.75 3 0 2.15 1.58 4.144 3.365 5.682A20.58 20.58 0 0 0 8 13.393a20.58 20.58 0 0 0 3.135-2.211C12.92 9.644 14.5 7.65 14.5 5.5c0-1.836-1.414-3-2.75-3-1.373 0-2.609.986-3.029 2.456a.749.749 0 0 1-1.442 0C6.859 3.486 5.623 2.5 4.25 2.5Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Your sponsors
</span></a>
  
  
</li>

        
          
<li data-item-id="" data-targets="nav-list.items" data-view-component="true" class="ActionListItem">
    
    <a data-analytics-event="{&quot;category&quot;:&quot;Global navigation&quot;,&quot;action&quot;:&quot;YOUR_GISTS&quot;,&quot;label&quot;:null}" id="item-4f12072b-7e5e-4151-bb43-e9c53402b509" href="https://gist.github.com/mine" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-code-square">
    <path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25Zm7.47 3.97a.75.75 0 0 1 1.06 0l2 2a.75.75 0 0 1 0 1.06l-2 2a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L10.69 8 9.22 6.53a.75.75 0 0 1 0-1.06ZM6.78 6.53 5.31 8l1.47 1.47a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215l-2-2a.75.75 0 0 1 0-1.06l2-2a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Your gists
</span></a>
  
  
</li>

        
          <li role="presentation" aria-hidden="true" data-view-component="true" class="ActionList-sectionDivider"></li>
        
          
<li data-item-id="" data-targets="nav-list.items" data-view-component="true" class="ActionListItem">
    
    <button id="item-f54743ea-1f1d-47f5-b25e-be0f0890f97a" type="button" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <span data-view-component="true" class="d-flex flex-items-center">    <svg style="box-sizing: content-box; color: var(--color-icon-primary);" width="16" height="16" viewBox="0 0 16 16" fill="none" data-view-component="true" class="anim-rotate">
  <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-opacity="0.25" stroke-width="2" vector-effect="non-scaling-stroke" fill="none" />
  <path d="M15 8a7.002 7.002 0 00-7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke" />
</svg>
</span>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          

  <span class="color-fg-muted">
    Loading...
  </span>

</span></button>
  
  
</li>

        
          
<li data-item-id="" data-targets="nav-list.items" data-view-component="true" class="ActionListItem">
    
    <button id="item-7a5a6cd5-1911-49b8-80e5-604d855064db" type="button" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <span data-view-component="true" class="d-flex flex-items-center">    <svg style="box-sizing: content-box; color: var(--color-icon-primary);" width="16" height="16" viewBox="0 0 16 16" fill="none" data-view-component="true" class="anim-rotate">
  <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-opacity="0.25" stroke-width="2" vector-effect="non-scaling-stroke" fill="none" />
  <path d="M15 8a7.002 7.002 0 00-7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke" />
</svg>
</span>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          

  <span class="color-fg-muted">
    Loading...
  </span>

</span></button>
  
  
</li>

        
          
<li data-item-id="" data-targets="nav-list.items" data-view-component="true" class="ActionListItem">
    
    <a data-analytics-event="{&quot;category&quot;:&quot;Global navigation&quot;,&quot;action&quot;:&quot;SETTINGS&quot;,&quot;label&quot;:null}" id="item-4695fc67-faaa-4e07-a9bc-2d23d6a391a5" href="/settings/profile" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-gear">
    <path d="M8 0a8.2 8.2 0 0 1 .701.031C9.444.095 9.99.645 10.16 1.29l.288 1.107c.018.066.079.158.212.224.231.114.454.243.668.386.123.082.233.09.299.071l1.103-.303c.644-.176 1.392.021 1.82.63.27.385.506.792.704 1.218.315.675.111 1.422-.364 1.891l-.814.806c-.049.048-.098.147-.088.294.016.257.016.515 0 .772-.01.147.038.246.088.294l.814.806c.475.469.679 1.216.364 1.891a7.977 7.977 0 0 1-.704 1.217c-.428.61-1.176.807-1.82.63l-1.102-.302c-.067-.019-.177-.011-.3.071a5.909 5.909 0 0 1-.668.386c-.133.066-.194.158-.211.224l-.29 1.106c-.168.646-.715 1.196-1.458 1.26a8.006 8.006 0 0 1-1.402 0c-.743-.064-1.289-.614-1.458-1.26l-.289-1.106c-.018-.066-.079-.158-.212-.224a5.738 5.738 0 0 1-.668-.386c-.123-.082-.233-.09-.299-.071l-1.103.303c-.644.176-1.392-.021-1.82-.63a8.12 8.12 0 0 1-.704-1.218c-.315-.675-.111-1.422.363-1.891l.815-.806c.05-.048.098-.147.088-.294a6.214 6.214 0 0 1 0-.772c.01-.147-.038-.246-.088-.294l-.815-.806C.635 6.045.431 5.298.746 4.623a7.92 7.92 0 0 1 .704-1.217c.428-.61 1.176-.807 1.82-.63l1.102.302c.067.019.177.011.3-.071.214-.143.437-.272.668-.386.133-.066.194-.158.211-.224l.29-1.106C6.009.645 6.556.095 7.299.03 7.53.01 7.764 0 8 0Zm-.571 1.525c-.036.003-.108.036-.137.146l-.289 1.105c-.147.561-.549.967-.998 1.189-.173.086-.34.183-.5.29-.417.278-.97.423-1.529.27l-1.103-.303c-.109-.03-.175.016-.195.045-.22.312-.412.644-.573.99-.014.031-.021.11.059.19l.815.806c.411.406.562.957.53 1.456a4.709 4.709 0 0 0 0 .582c.032.499-.119 1.05-.53 1.456l-.815.806c-.081.08-.073.159-.059.19.162.346.353.677.573.989.02.03.085.076.195.046l1.102-.303c.56-.153 1.113-.008 1.53.27.161.107.328.204.501.29.447.222.85.629.997 1.189l.289 1.105c.029.109.101.143.137.146a6.6 6.6 0 0 0 1.142 0c.036-.003.108-.036.137-.146l.289-1.105c.147-.561.549-.967.998-1.189.173-.086.34-.183.5-.29.417-.278.97-.423 1.529-.27l1.103.303c.109.029.175-.016.195-.045.22-.313.411-.644.573-.99.014-.031.021-.11-.059-.19l-.815-.806c-.411-.406-.562-.957-.53-1.456a4.709 4.709 0 0 0 0-.582c-.032-.499.119-1.05.53-1.456l.815-.806c.081-.08.073-.159.059-.19a6.464 6.464 0 0 0-.573-.989c-.02-.03-.085-.076-.195-.046l-1.102.303c-.56.153-1.113.008-1.53-.27a4.44 4.44 0 0 0-.501-.29c-.447-.222-.85-.629-.997-1.189l-.289-1.105c-.029-.11-.101-.143-.137-.146a6.6 6.6 0 0 0-1.142 0ZM11 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM9.5 8a1.5 1.5 0 1 0-3.001.001A1.5 1.5 0 0 0 9.5 8Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Settings
</span></a>
  
  
</li>

        
          <li role="presentation" aria-hidden="true" data-view-component="true" class="ActionList-sectionDivider"></li>
        
          
<li data-item-id="" data-targets="nav-list.items" data-view-component="true" class="ActionListItem">
    
    <a data-analytics-event="{&quot;category&quot;:&quot;Global navigation&quot;,&quot;action&quot;:&quot;SUPPORT&quot;,&quot;label&quot;:null}" id="item-b3a926ec-0503-4f4f-a08b-0266b5acf429" href="https://support.github.com" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-people">
    <path d="M2 5.5a3.5 3.5 0 1 1 5.898 2.549 5.508 5.508 0 0 1 3.034 4.084.75.75 0 1 1-1.482.235 4 4 0 0 0-7.9 0 .75.75 0 0 1-1.482-.236A5.507 5.507 0 0 1 3.102 8.05 3.493 3.493 0 0 1 2 5.5ZM11 4a3.001 3.001 0 0 1 2.22 5.018 5.01 5.01 0 0 1 2.56 3.012.749.749 0 0 1-.885.954.752.752 0 0 1-.549-.514 3.507 3.507 0 0 0-2.522-2.372.75.75 0 0 1-.574-.73v-.352a.75.75 0 0 1 .416-.672A1.5 1.5 0 0 0 11 5.5.75.75 0 0 1 11 4Zm-5.5-.5a2 2 0 1 0-.001 3.999A2 2 0 0 0 5.5 3.5Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          GitHub Support
</span></a>
  
  
</li>

        
          
<li data-item-id="" data-targets="nav-list.items" data-view-component="true" class="ActionListItem">
    
    <a data-analytics-event="{&quot;category&quot;:&quot;Global navigation&quot;,&quot;action&quot;:&quot;COMMUNITY&quot;,&quot;label&quot;:null}" id="item-d64069be-e24d-4ada-a3e6-897ffea0e0df" href="https://community.github.com" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-comment-discussion">
    <path d="M1.75 1h8.5c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 10.25 10H7.061l-2.574 2.573A1.458 1.458 0 0 1 2 11.543V10h-.25A1.75 1.75 0 0 1 0 8.25v-5.5C0 1.784.784 1 1.75 1ZM1.5 2.75v5.5c0 .138.112.25.25.25h1a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h3.5a.25.25 0 0 0 .25-.25v-5.5a.25.25 0 0 0-.25-.25h-8.5a.25.25 0 0 0-.25.25Zm13 2a.25.25 0 0 0-.25-.25h-.5a.75.75 0 0 1 0-1.5h.5c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 14.25 12H14v1.543a1.458 1.458 0 0 1-2.487 1.03L9.22 12.28a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215l2.22 2.22v-2.19a.75.75 0 0 1 .75-.75h1a.25.25 0 0 0 .25-.25Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          GitHub Community
</span></a>
  
  
</li>

        
          <li role="presentation" aria-hidden="true" data-view-component="true" class="ActionList-sectionDivider"></li>
        
          
<li data-item-id="" data-targets="nav-list.items" data-view-component="true" class="ActionListItem">
    
    <a data-analytics-event="{&quot;category&quot;:&quot;Global navigation&quot;,&quot;action&quot;:&quot;LOGOUT&quot;,&quot;label&quot;:null}" id="item-646894d1-020c-447d-9dc8-4e373bbcff9c" href="/logout" data-view-component="true" class="ActionListContent">
      
        <span data-view-component="true" class="ActionListItem-label">
          Sign out
</span></a>
  
  
</li>

</ul>  </nav-list>
</nav>


</div>
</div>
      </scrollable-region>
      
</dialog></dialog-helper>
    </user-drawer-side-panel>

  </include-fragment>
</deferred-side-panel>
        </div>

        <div class="position-absolute mt-2">
            
<site-header-logged-in-user-menu>

</site-header-logged-in-user-menu>

        </div>
      </div>
    </div>


      <div class="AppHeader-localBar" >
        <nav data-pjax="#js-repo-pjax-container" aria-label="Repository" data-view-component="true" class="js-repo-nav js-sidenav-container-pjax js-responsive-underlinenav overflow-hidden UnderlineNav">

  <ul data-view-component="true" class="UnderlineNav-body list-style-none">
      <li data-view-component="true" class="d-inline-flex">
  <a id="code-tab" href="/HiromiShikata/test-repository" data-tab-item="i0code-tab" data-selected-links="repo_source repo_downloads repo_commits repo_releases repo_tags repo_branches repo_packages repo_deployments repo_attestations /HiromiShikata/test-repository" data-pjax="#repo-content-pjax-container" data-turbo-frame="repo-content-turbo-frame" data-hotkey="g c" data-analytics-event="{&quot;category&quot;:&quot;Underline navbar&quot;,&quot;action&quot;:&quot;Click tab&quot;,&quot;label&quot;:&quot;Code&quot;,&quot;target&quot;:&quot;UNDERLINE_NAV.TAB&quot;}" data-view-component="true" class="UnderlineNav-item no-wrap js-responsive-underlinenav-item js-selected-navigation-item">
    
              <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-code UnderlineNav-octicon d-none d-sm-inline">
    <path d="m11.28 3.22 4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L13.94 8l-3.72-3.72a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215Zm-6.56 0a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L2.06 8l3.72 3.72a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L.47 8.53a.75.75 0 0 1 0-1.06Z"></path>
</svg>
        <span data-content="Code">Code</span>
          <span id="code-repo-tab-count" data-pjax-replace="" data-turbo-replace="" title="Not available" data-view-component="true" class="Counter"></span>


    
</a></li>
      <li data-view-component="true" class="d-inline-flex">
  <a id="issues-tab" href="/HiromiShikata/test-repository/issues" data-tab-item="i1issues-tab" data-selected-links="repo_issues repo_labels repo_milestones /HiromiShikata/test-repository/issues" data-pjax="#repo-content-pjax-container" data-turbo-frame="repo-content-turbo-frame" data-hotkey="g i" data-analytics-event="{&quot;category&quot;:&quot;Underline navbar&quot;,&quot;action&quot;:&quot;Click tab&quot;,&quot;label&quot;:&quot;Issues&quot;,&quot;target&quot;:&quot;UNDERLINE_NAV.TAB&quot;}" data-view-component="true" class="UnderlineNav-item no-wrap js-responsive-underlinenav-item js-selected-navigation-item">
    
              <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-issue-opened UnderlineNav-octicon d-none d-sm-inline">
    <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"></path><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"></path>
</svg>
        <span data-content="Issues">Issues</span>
          <span id="issues-repo-tab-count" data-pjax-replace="" data-turbo-replace="" title="2" data-view-component="true" class="Counter">2</span>


    
</a></li>
      <li data-view-component="true" class="d-inline-flex">
  <a id="pull-requests-tab" href="/HiromiShikata/test-repository/pulls" data-tab-item="i2pull-requests-tab" data-selected-links="repo_pulls checks /HiromiShikata/test-repository/pulls" data-pjax="#repo-content-pjax-container" data-turbo-frame="repo-content-turbo-frame" data-hotkey="g p" data-analytics-event="{&quot;category&quot;:&quot;Underline navbar&quot;,&quot;action&quot;:&quot;Click tab&quot;,&quot;label&quot;:&quot;Pull requests&quot;,&quot;target&quot;:&quot;UNDERLINE_NAV.TAB&quot;}" data-view-component="true" class="UnderlineNav-item no-wrap js-responsive-underlinenav-item js-selected-navigation-item">
    
              <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-git-pull-request UnderlineNav-octicon d-none d-sm-inline">
    <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z"></path>
</svg>
        <span data-content="Pull requests">Pull requests</span>
          <span id="pull-requests-repo-tab-count" data-pjax-replace="" data-turbo-replace="" title="0" hidden="hidden" data-view-component="true" class="Counter">0</span>


    
</a></li>
      <li data-view-component="true" class="d-inline-flex">
  <a id="actions-tab" href="/HiromiShikata/test-repository/actions" data-tab-item="i3actions-tab" data-selected-links="repo_actions /HiromiShikata/test-repository/actions" data-pjax="#repo-content-pjax-container" data-turbo-frame="repo-content-turbo-frame" data-hotkey="g a" data-analytics-event="{&quot;category&quot;:&quot;Underline navbar&quot;,&quot;action&quot;:&quot;Click tab&quot;,&quot;label&quot;:&quot;Actions&quot;,&quot;target&quot;:&quot;UNDERLINE_NAV.TAB&quot;}" data-view-component="true" class="UnderlineNav-item no-wrap js-responsive-underlinenav-item js-selected-navigation-item">
    
              <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-play UnderlineNav-octicon d-none d-sm-inline">
    <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm4.879-2.773 4.264 2.559a.25.25 0 0 1 0 .428l-4.264 2.559A.25.25 0 0 1 6 10.559V5.442a.25.25 0 0 1 .379-.215Z"></path>
</svg>
        <span data-content="Actions">Actions</span>
          <span id="actions-repo-tab-count" data-pjax-replace="" data-turbo-replace="" title="Not available" data-view-component="true" class="Counter"></span>


    
</a></li>
      <li data-view-component="true" class="d-inline-flex">
  <a id="projects-tab" href="/HiromiShikata/test-repository/projects" data-tab-item="i4projects-tab" data-selected-links="repo_projects new_repo_project repo_project /HiromiShikata/test-repository/projects" data-pjax="#repo-content-pjax-container" data-turbo-frame="repo-content-turbo-frame" data-hotkey="g b" data-analytics-event="{&quot;category&quot;:&quot;Underline navbar&quot;,&quot;action&quot;:&quot;Click tab&quot;,&quot;label&quot;:&quot;Projects&quot;,&quot;target&quot;:&quot;UNDERLINE_NAV.TAB&quot;}" data-view-component="true" class="UnderlineNav-item no-wrap js-responsive-underlinenav-item js-selected-navigation-item">
    
              <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-table UnderlineNav-octicon d-none d-sm-inline">
    <path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25ZM6.5 6.5v8h7.75a.25.25 0 0 0 .25-.25V6.5Zm8-1.5V1.75a.25.25 0 0 0-.25-.25H6.5V5Zm-13 1.5v7.75c0 .138.112.25.25.25H5v-8ZM5 5V1.5H1.75a.25.25 0 0 0-.25.25V5Z"></path>
</svg>
        <span data-content="Projects">Projects</span>
          <span id="projects-repo-tab-count" data-pjax-replace="" data-turbo-replace="" title="2" data-view-component="true" class="Counter">2</span>


    
</a></li>
      <li data-view-component="true" class="d-inline-flex">
  <a id="wiki-tab" href="/HiromiShikata/test-repository/wiki" data-tab-item="i5wiki-tab" data-selected-links="repo_wiki /HiromiShikata/test-repository/wiki" data-pjax="#repo-content-pjax-container" data-turbo-frame="repo-content-turbo-frame" data-hotkey="g w" data-analytics-event="{&quot;category&quot;:&quot;Underline navbar&quot;,&quot;action&quot;:&quot;Click tab&quot;,&quot;label&quot;:&quot;Wiki&quot;,&quot;target&quot;:&quot;UNDERLINE_NAV.TAB&quot;}" data-view-component="true" class="UnderlineNav-item no-wrap js-responsive-underlinenav-item js-selected-navigation-item">
    
              <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-book UnderlineNav-octicon d-none d-sm-inline">
    <path d="M0 1.75A.75.75 0 0 1 .75 1h4.253c1.227 0 2.317.59 3 1.501A3.743 3.743 0 0 1 11.006 1h4.245a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75h-4.507a2.25 2.25 0 0 0-1.591.659l-.622.621a.75.75 0 0 1-1.06 0l-.622-.621A2.25 2.25 0 0 0 5.258 13H.75a.75.75 0 0 1-.75-.75Zm7.251 10.324.004-5.073-.002-2.253A2.25 2.25 0 0 0 5.003 2.5H1.5v9h3.757a3.75 3.75 0 0 1 1.994.574ZM8.755 4.75l-.004 7.322a3.752 3.752 0 0 1 1.992-.572H14.5v-9h-3.495a2.25 2.25 0 0 0-2.25 2.25Z"></path>
</svg>
        <span data-content="Wiki">Wiki</span>
          <span id="wiki-repo-tab-count" data-pjax-replace="" data-turbo-replace="" title="Not available" data-view-component="true" class="Counter"></span>


    
</a></li>
      <li data-view-component="true" class="d-inline-flex">
  <a id="security-tab" href="/HiromiShikata/test-repository/security" data-tab-item="i6security-tab" data-selected-links="security overview alerts policy token_scanning code_scanning /HiromiShikata/test-repository/security" data-pjax="#repo-content-pjax-container" data-turbo-frame="repo-content-turbo-frame" data-hotkey="g s" data-analytics-event="{&quot;category&quot;:&quot;Underline navbar&quot;,&quot;action&quot;:&quot;Click tab&quot;,&quot;label&quot;:&quot;Security&quot;,&quot;target&quot;:&quot;UNDERLINE_NAV.TAB&quot;}" data-view-component="true" class="UnderlineNav-item no-wrap js-responsive-underlinenav-item js-selected-navigation-item">
    
              <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-shield UnderlineNav-octicon d-none d-sm-inline">
    <path d="M7.467.133a1.748 1.748 0 0 1 1.066 0l5.25 1.68A1.75 1.75 0 0 1 15 3.48V7c0 1.566-.32 3.182-1.303 4.682-.983 1.498-2.585 2.813-5.032 3.855a1.697 1.697 0 0 1-1.33 0c-2.447-1.042-4.049-2.357-5.032-3.855C1.32 10.182 1 8.566 1 7V3.48a1.75 1.75 0 0 1 1.217-1.667Zm.61 1.429a.25.25 0 0 0-.153 0l-5.25 1.68a.25.25 0 0 0-.174.238V7c0 1.358.275 2.666 1.057 3.86.784 1.194 2.121 2.34 4.366 3.297a.196.196 0 0 0 .154 0c2.245-.956 3.582-2.104 4.366-3.298C13.225 9.666 13.5 8.36 13.5 7V3.48a.251.251 0 0 0-.174-.237l-5.25-1.68ZM8.75 4.75v3a.75.75 0 0 1-1.5 0v-3a.75.75 0 0 1 1.5 0ZM9 10.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"></path>
</svg>
        <span data-content="Security">Security</span>
          <include-fragment src="/HiromiShikata/test-repository/security/overall-count" accept="text/fragment+html"></include-fragment>

    
</a></li>
      <li data-view-component="true" class="d-inline-flex">
  <a id="insights-tab" href="/HiromiShikata/test-repository/pulse" data-tab-item="i7insights-tab" data-selected-links="repo_graphs repo_contributors dependency_graph dependabot_updates pulse people community /HiromiShikata/test-repository/pulse" data-pjax="#repo-content-pjax-container" data-turbo-frame="repo-content-turbo-frame" data-analytics-event="{&quot;category&quot;:&quot;Underline navbar&quot;,&quot;action&quot;:&quot;Click tab&quot;,&quot;label&quot;:&quot;Insights&quot;,&quot;target&quot;:&quot;UNDERLINE_NAV.TAB&quot;}" data-view-component="true" class="UnderlineNav-item no-wrap js-responsive-underlinenav-item js-selected-navigation-item">
    
              <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-graph UnderlineNav-octicon d-none d-sm-inline">
    <path d="M1.5 1.75V13.5h13.75a.75.75 0 0 1 0 1.5H.75a.75.75 0 0 1-.75-.75V1.75a.75.75 0 0 1 1.5 0Zm14.28 2.53-5.25 5.25a.75.75 0 0 1-1.06 0L7 7.06 4.28 9.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l3.25-3.25a.75.75 0 0 1 1.06 0L10 7.94l4.72-4.72a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z"></path>
</svg>
        <span data-content="Insights">Insights</span>
          <span id="insights-repo-tab-count" data-pjax-replace="" data-turbo-replace="" title="Not available" data-view-component="true" class="Counter"></span>


    
</a></li>
      <li data-view-component="true" class="d-inline-flex">
  <a id="settings-tab" href="/HiromiShikata/test-repository/settings" data-tab-item="i8settings-tab" data-selected-links="code_review_limits codespaces_repository_settings collaborators custom_tabs hooks integration_installations interaction_limits issue_template_editor key_links_settings notifications repo_announcements repo_branch_settings repo_keys_settings repo_pages_settings repo_rule_insights repo_rulesets repo_rules_bypass_requests repo_protected_tags_settings repo_settings reported_content repo_custom_properties repository_actions_settings repository_actions_settings_add_new_runner repository_actions_settings_general repository_actions_settings_runners repository_actions_settings_runner_details repository_environments role_details secrets secrets_settings_actions secrets_settings_codespaces secrets_settings_dependabot security_analysis security_products /HiromiShikata/test-repository/settings" data-pjax="#repo-content-pjax-container" data-turbo-frame="repo-content-turbo-frame" data-analytics-event="{&quot;category&quot;:&quot;Underline navbar&quot;,&quot;action&quot;:&quot;Click tab&quot;,&quot;label&quot;:&quot;Settings&quot;,&quot;target&quot;:&quot;UNDERLINE_NAV.TAB&quot;}" data-view-component="true" class="UnderlineNav-item no-wrap js-responsive-underlinenav-item js-selected-navigation-item">
    
              <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-gear UnderlineNav-octicon d-none d-sm-inline">
    <path d="M8 0a8.2 8.2 0 0 1 .701.031C9.444.095 9.99.645 10.16 1.29l.288 1.107c.018.066.079.158.212.224.231.114.454.243.668.386.123.082.233.09.299.071l1.103-.303c.644-.176 1.392.021 1.82.63.27.385.506.792.704 1.218.315.675.111 1.422-.364 1.891l-.814.806c-.049.048-.098.147-.088.294.016.257.016.515 0 .772-.01.147.038.246.088.294l.814.806c.475.469.679 1.216.364 1.891a7.977 7.977 0 0 1-.704 1.217c-.428.61-1.176.807-1.82.63l-1.102-.302c-.067-.019-.177-.011-.3.071a5.909 5.909 0 0 1-.668.386c-.133.066-.194.158-.211.224l-.29 1.106c-.168.646-.715 1.196-1.458 1.26a8.006 8.006 0 0 1-1.402 0c-.743-.064-1.289-.614-1.458-1.26l-.289-1.106c-.018-.066-.079-.158-.212-.224a5.738 5.738 0 0 1-.668-.386c-.123-.082-.233-.09-.299-.071l-1.103.303c-.644.176-1.392-.021-1.82-.63a8.12 8.12 0 0 1-.704-1.218c-.315-.675-.111-1.422.363-1.891l.815-.806c.05-.048.098-.147.088-.294a6.214 6.214 0 0 1 0-.772c.01-.147-.038-.246-.088-.294l-.815-.806C.635 6.045.431 5.298.746 4.623a7.92 7.92 0 0 1 .704-1.217c.428-.61 1.176-.807 1.82-.63l1.102.302c.067.019.177.011.3-.071.214-.143.437-.272.668-.386.133-.066.194-.158.211-.224l.29-1.106C6.009.645 6.556.095 7.299.03 7.53.01 7.764 0 8 0Zm-.571 1.525c-.036.003-.108.036-.137.146l-.289 1.105c-.147.561-.549.967-.998 1.189-.173.086-.34.183-.5.29-.417.278-.97.423-1.529.27l-1.103-.303c-.109-.03-.175.016-.195.045-.22.312-.412.644-.573.99-.014.031-.021.11.059.19l.815.806c.411.406.562.957.53 1.456a4.709 4.709 0 0 0 0 .582c.032.499-.119 1.05-.53 1.456l-.815.806c-.081.08-.073.159-.059.19.162.346.353.677.573.989.02.03.085.076.195.046l1.102-.303c.56-.153 1.113-.008 1.53.27.161.107.328.204.501.29.447.222.85.629.997 1.189l.289 1.105c.029.109.101.143.137.146a6.6 6.6 0 0 0 1.142 0c.036-.003.108-.036.137-.146l.289-1.105c.147-.561.549-.967.998-1.189.173-.086.34-.183.5-.29.417-.278.97-.423 1.529-.27l1.103.303c.109.029.175-.016.195-.045.22-.313.411-.644.573-.99.014-.031.021-.11-.059-.19l-.815-.806c-.411-.406-.562-.957-.53-1.456a4.709 4.709 0 0 0 0-.582c-.032-.499.119-1.05.53-1.456l.815-.806c.081-.08.073-.159.059-.19a6.464 6.464 0 0 0-.573-.989c-.02-.03-.085-.076-.195-.046l-1.102.303c-.56.153-1.113.008-1.53-.27a4.44 4.44 0 0 0-.501-.29c-.447-.222-.85-.629-.997-1.189l-.289-1.105c-.029-.11-.101-.143-.137-.146a6.6 6.6 0 0 0-1.142 0ZM11 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM9.5 8a1.5 1.5 0 1 0-3.001.001A1.5 1.5 0 0 0 9.5 8Z"></path>
</svg>
        <span data-content="Settings">Settings</span>
          <span id="settings-repo-tab-count" data-pjax-replace="" data-turbo-replace="" title="Not available" data-view-component="true" class="Counter"></span>


    
</a></li>
</ul>
    <div style="visibility:hidden;" data-view-component="true" class="UnderlineNav-actions js-responsive-underlinenav-overflow position-absolute pr-3 pr-md-4 pr-lg-5 right-0">      <action-menu data-select-variant="none" data-view-component="true">
  <focus-group direction="vertical" mnemonics retain>
    <button id="action-menu-4173719d-9aec-4117-ba00-0abd4cada2df-button" popovertarget="action-menu-4173719d-9aec-4117-ba00-0abd4cada2df-overlay" aria-controls="action-menu-4173719d-9aec-4117-ba00-0abd4cada2df-list" aria-haspopup="true" aria-labelledby="tooltip-b872576c-8e60-48c5-a8d4-92fa39d92d42" type="button" data-view-component="true" class="Button Button--iconOnly Button--secondary Button--medium UnderlineNav-item">  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-kebab-horizontal Button-visual">
    <path d="M8 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM1.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm13 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"></path>
</svg>
</button><tool-tip id="tooltip-b872576c-8e60-48c5-a8d4-92fa39d92d42" for="action-menu-4173719d-9aec-4117-ba00-0abd4cada2df-button" popover="manual" data-direction="s" data-type="label" data-view-component="true" class="sr-only position-absolute">Additional navigation options</tool-tip>


<anchored-position id="action-menu-4173719d-9aec-4117-ba00-0abd4cada2df-overlay" anchor="action-menu-4173719d-9aec-4117-ba00-0abd4cada2df-button" align="start" side="outside-bottom" anchor-offset="normal" popover="auto" data-view-component="true">
  <div data-view-component="true" class="Overlay Overlay--size-auto">
    
      <div data-view-component="true" class="Overlay-body Overlay-body--paddingNone">          <action-list>
  <div data-view-component="true">
    <ul aria-labelledby="action-menu-4173719d-9aec-4117-ba00-0abd4cada2df-button" id="action-menu-4173719d-9aec-4117-ba00-0abd4cada2df-list" role="menu" data-view-component="true" class="ActionListWrap--inset ActionListWrap">
        <li hidden="hidden" data-menu-item="i0code-tab" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <a tabindex="-1" id="item-df6f58de-b172-4375-9511-08d7b7cfcbf0" href="/HiromiShikata/test-repository" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-code">
    <path d="m11.28 3.22 4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L13.94 8l-3.72-3.72a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215Zm-6.56 0a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L2.06 8l3.72 3.72a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L.47 8.53a.75.75 0 0 1 0-1.06Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Code
</span></a>
  
  
</li>
        <li hidden="hidden" data-menu-item="i1issues-tab" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <a tabindex="-1" id="item-fe4cdf45-2e61-450a-9926-3b7d451a5f40" href="/HiromiShikata/test-repository/issues" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-issue-opened">
    <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"></path><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Issues
</span></a>
  
  
</li>
        <li hidden="hidden" data-menu-item="i2pull-requests-tab" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <a tabindex="-1" id="item-146128f0-5cba-4754-af6e-9889e5d40e26" href="/HiromiShikata/test-repository/pulls" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-git-pull-request">
    <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Pull requests
</span></a>
  
  
</li>
        <li hidden="hidden" data-menu-item="i3actions-tab" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <a tabindex="-1" id="item-2974493d-b937-4c63-8e1d-e6cee5a81f92" href="/HiromiShikata/test-repository/actions" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-play">
    <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm4.879-2.773 4.264 2.559a.25.25 0 0 1 0 .428l-4.264 2.559A.25.25 0 0 1 6 10.559V5.442a.25.25 0 0 1 .379-.215Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Actions
</span></a>
  
  
</li>
        <li hidden="hidden" data-menu-item="i4projects-tab" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <a tabindex="-1" id="item-d01bc1d1-1e9c-40b4-9f41-a1ccc9a1ea68" href="/HiromiShikata/test-repository/projects" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-table">
    <path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25ZM6.5 6.5v8h7.75a.25.25 0 0 0 .25-.25V6.5Zm8-1.5V1.75a.25.25 0 0 0-.25-.25H6.5V5Zm-13 1.5v7.75c0 .138.112.25.25.25H5v-8ZM5 5V1.5H1.75a.25.25 0 0 0-.25.25V5Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Projects
</span></a>
  
  
</li>
        <li hidden="hidden" data-menu-item="i5wiki-tab" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <a tabindex="-1" id="item-4f58b2fb-7b43-4def-8718-66da0e42f49a" href="/HiromiShikata/test-repository/wiki" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-book">
    <path d="M0 1.75A.75.75 0 0 1 .75 1h4.253c1.227 0 2.317.59 3 1.501A3.743 3.743 0 0 1 11.006 1h4.245a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75h-4.507a2.25 2.25 0 0 0-1.591.659l-.622.621a.75.75 0 0 1-1.06 0l-.622-.621A2.25 2.25 0 0 0 5.258 13H.75a.75.75 0 0 1-.75-.75Zm7.251 10.324.004-5.073-.002-2.253A2.25 2.25 0 0 0 5.003 2.5H1.5v9h3.757a3.75 3.75 0 0 1 1.994.574ZM8.755 4.75l-.004 7.322a3.752 3.752 0 0 1 1.992-.572H14.5v-9h-3.495a2.25 2.25 0 0 0-2.25 2.25Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Wiki
</span></a>
  
  
</li>
        <li hidden="hidden" data-menu-item="i6security-tab" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <a tabindex="-1" id="item-a590b12e-e458-46ef-aeaf-5d24af640927" href="/HiromiShikata/test-repository/security" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-shield">
    <path d="M7.467.133a1.748 1.748 0 0 1 1.066 0l5.25 1.68A1.75 1.75 0 0 1 15 3.48V7c0 1.566-.32 3.182-1.303 4.682-.983 1.498-2.585 2.813-5.032 3.855a1.697 1.697 0 0 1-1.33 0c-2.447-1.042-4.049-2.357-5.032-3.855C1.32 10.182 1 8.566 1 7V3.48a1.75 1.75 0 0 1 1.217-1.667Zm.61 1.429a.25.25 0 0 0-.153 0l-5.25 1.68a.25.25 0 0 0-.174.238V7c0 1.358.275 2.666 1.057 3.86.784 1.194 2.121 2.34 4.366 3.297a.196.196 0 0 0 .154 0c2.245-.956 3.582-2.104 4.366-3.298C13.225 9.666 13.5 8.36 13.5 7V3.48a.251.251 0 0 0-.174-.237l-5.25-1.68ZM8.75 4.75v3a.75.75 0 0 1-1.5 0v-3a.75.75 0 0 1 1.5 0ZM9 10.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Security
</span></a>
  
  
</li>
        <li hidden="hidden" data-menu-item="i7insights-tab" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <a tabindex="-1" id="item-edc4b133-09fe-46cd-a59b-822327fc0498" href="/HiromiShikata/test-repository/pulse" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-graph">
    <path d="M1.5 1.75V13.5h13.75a.75.75 0 0 1 0 1.5H.75a.75.75 0 0 1-.75-.75V1.75a.75.75 0 0 1 1.5 0Zm14.28 2.53-5.25 5.25a.75.75 0 0 1-1.06 0L7 7.06 4.28 9.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l3.25-3.25a.75.75 0 0 1 1.06 0L10 7.94l4.72-4.72a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Insights
</span></a>
  
  
</li>
        <li hidden="hidden" data-menu-item="i8settings-tab" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <a tabindex="-1" id="item-79f583f6-d70d-4989-8167-6413a6e1778c" href="/HiromiShikata/test-repository/settings" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-gear">
    <path d="M8 0a8.2 8.2 0 0 1 .701.031C9.444.095 9.99.645 10.16 1.29l.288 1.107c.018.066.079.158.212.224.231.114.454.243.668.386.123.082.233.09.299.071l1.103-.303c.644-.176 1.392.021 1.82.63.27.385.506.792.704 1.218.315.675.111 1.422-.364 1.891l-.814.806c-.049.048-.098.147-.088.294.016.257.016.515 0 .772-.01.147.038.246.088.294l.814.806c.475.469.679 1.216.364 1.891a7.977 7.977 0 0 1-.704 1.217c-.428.61-1.176.807-1.82.63l-1.102-.302c-.067-.019-.177-.011-.3.071a5.909 5.909 0 0 1-.668.386c-.133.066-.194.158-.211.224l-.29 1.106c-.168.646-.715 1.196-1.458 1.26a8.006 8.006 0 0 1-1.402 0c-.743-.064-1.289-.614-1.458-1.26l-.289-1.106c-.018-.066-.079-.158-.212-.224a5.738 5.738 0 0 1-.668-.386c-.123-.082-.233-.09-.299-.071l-1.103.303c-.644.176-1.392-.021-1.82-.63a8.12 8.12 0 0 1-.704-1.218c-.315-.675-.111-1.422.363-1.891l.815-.806c.05-.048.098-.147.088-.294a6.214 6.214 0 0 1 0-.772c.01-.147-.038-.246-.088-.294l-.815-.806C.635 6.045.431 5.298.746 4.623a7.92 7.92 0 0 1 .704-1.217c.428-.61 1.176-.807 1.82-.63l1.102.302c.067.019.177.011.3-.071.214-.143.437-.272.668-.386.133-.066.194-.158.211-.224l.29-1.106C6.009.645 6.556.095 7.299.03 7.53.01 7.764 0 8 0Zm-.571 1.525c-.036.003-.108.036-.137.146l-.289 1.105c-.147.561-.549.967-.998 1.189-.173.086-.34.183-.5.29-.417.278-.97.423-1.529.27l-1.103-.303c-.109-.03-.175.016-.195.045-.22.312-.412.644-.573.99-.014.031-.021.11.059.19l.815.806c.411.406.562.957.53 1.456a4.709 4.709 0 0 0 0 .582c.032.499-.119 1.05-.53 1.456l-.815.806c-.081.08-.073.159-.059.19.162.346.353.677.573.989.02.03.085.076.195.046l1.102-.303c.56-.153 1.113-.008 1.53.27.161.107.328.204.501.29.447.222.85.629.997 1.189l.289 1.105c.029.109.101.143.137.146a6.6 6.6 0 0 0 1.142 0c.036-.003.108-.036.137-.146l.289-1.105c.147-.561.549-.967.998-1.189.173-.086.34-.183.5-.29.417-.278.97-.423 1.529-.27l1.103.303c.109.029.175-.016.195-.045.22-.313.411-.644.573-.99.014-.031.021-.11-.059-.19l-.815-.806c-.411-.406-.562-.957-.53-1.456a4.709 4.709 0 0 0 0-.582c-.032-.499.119-1.05.53-1.456l.815-.806c.081-.08.073-.159.059-.19a6.464 6.464 0 0 0-.573-.989c-.02-.03-.085-.076-.195-.046l-1.102.303c-.56.153-1.113.008-1.53-.27a4.44 4.44 0 0 0-.501-.29c-.447-.222-.85-.629-.997-1.189l-.289-1.105c-.029-.11-.101-.143-.137-.146a6.6 6.6 0 0 0-1.142 0ZM11 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM9.5 8a1.5 1.5 0 1 0-3.001.001A1.5 1.5 0 0 0 9.5 8Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Settings
</span></a>
  
  
</li>
</ul>    
</div></action-list>


</div>
      
</div></anchored-position>  </focus-group>
</action-menu></div>
</nav>
      </div>
</header>


      <div hidden="hidden" data-view-component="true" class="js-stale-session-flash stale-session-flash flash flash-warn flash-full mb-3">
  
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-alert">
    <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"></path>
</svg>
        <span class="js-stale-session-flash-signed-in" hidden>You signed in with another tab or window. <a class="Link--inTextBlock" href="">Reload</a> to refresh your session.</span>
        <span class="js-stale-session-flash-signed-out" hidden>You signed out in another tab or window. <a class="Link--inTextBlock" href="">Reload</a> to refresh your session.</span>
        <span class="js-stale-session-flash-switched" hidden>You switched accounts on another tab or window. <a class="Link--inTextBlock" href="">Reload</a> to refresh your session.</span>

    <button id="icon-button-9df44971-4145-44d4-958c-2139a21c4c6a" aria-labelledby="tooltip-93ef87b9-2180-483e-822b-1381543d6b3a" type="button" data-view-component="true" class="Button Button--iconOnly Button--invisible Button--medium flash-close js-flash-close">  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-x Button-visual">
    <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path>
</svg>
</button><tool-tip id="tooltip-93ef87b9-2180-483e-822b-1381543d6b3a" for="icon-button-9df44971-4145-44d4-958c-2139a21c4c6a" popover="manual" data-direction="s" data-type="label" data-view-component="true" class="sr-only position-absolute">Dismiss alert</tool-tip>


  
</div>
          
    </div>

  <div id="start-of-content" class="show-on-focus"></div>








    <div id="js-flash-container" data-turbo-replace>





  <template class="js-flash-template">
    
<div class="flash flash-full   {{ className }}">
  <div >
    <button autofocus class="flash-close js-flash-close" type="button" aria-label="Dismiss this message">
      <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-x">
    <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path>
</svg>
    </button>
    <div aria-atomic="true" role="alert" class="js-flash-alert">
      
      <div>{{ message }}</div>

    </div>
  </div>
</div>
  </template>
</div>


    
    <notification-shelf-watcher data-base-url="https://github.com/notifications/beta/shelf" data-channel="eyJjIjoibm90aWZpY2F0aW9uLWNoYW5nZWQ6NjQ0MDgxMSIsInQiOjE3MTM2OTY0MTZ9--62f24f515bab34125fcd938e4c90dfb13aed89bcb9e4469f204bddc48620a83a" data-view-component="true" class="js-socket-channel"></notification-shelf-watcher>
  <div hidden data-initial data-target="notification-shelf-watcher.placeholder"></div>





      <details
  class="details-reset details-overlay details-overlay-dark js-command-palette-dialog"
  id="command-palette-pjax-container"
  data-turbo-replace
>
  <summary aria-label="Command palette trigger" tabindex="-1"></summary>
  <details-dialog class="command-palette-details-dialog d-flex flex-column flex-justify-center height-fit" aria-label="Command palette">
    <command-palette
      class="command-palette color-bg-default rounded-3 border color-shadow-small"
      return-to=/_view_fragments/issues/show/HiromiShikata/test-repository/38/issue_layout
      user-id="6440811"
      activation-hotkey="Mod+k,Mod+Alt+k"
      command-mode-hotkey="Mod+Shift+K"
      data-action="
        command-palette-input-ready:command-palette#inputReady
        command-palette-page-stack-updated:command-palette#updateInputScope
        itemsUpdated:command-palette#itemsUpdated
        keydown:command-palette#onKeydown
        loadingStateChanged:command-palette#loadingStateChanged
        selectedItemChanged:command-palette#selectedItemChanged
        pageFetchError:command-palette#pageFetchError
      ">

        <command-palette-mode
          data-char="#"
            data-scope-types="[&quot;&quot;]"
            data-placeholder="Search issues and pull requests"
        ></command-palette-mode>
        <command-palette-mode
          data-char="#"
            data-scope-types="[&quot;owner&quot;,&quot;repository&quot;]"
            data-placeholder="Search issues, pull requests, discussions, and projects"
        ></command-palette-mode>
        <command-palette-mode
          data-char="!"
            data-scope-types="[&quot;owner&quot;,&quot;repository&quot;]"
            data-placeholder="Search projects"
        ></command-palette-mode>
        <command-palette-mode
          data-char="@"
            data-scope-types="[&quot;&quot;]"
            data-placeholder="Search or jump to a user, organization, or repository"
        ></command-palette-mode>
        <command-palette-mode
          data-char="@"
            data-scope-types="[&quot;owner&quot;]"
            data-placeholder="Search or jump to a repository"
        ></command-palette-mode>
        <command-palette-mode
          data-char="/"
            data-scope-types="[&quot;repository&quot;]"
            data-placeholder="Search files"
        ></command-palette-mode>
        <command-palette-mode
          data-char="?"
        ></command-palette-mode>
        <command-palette-mode
          data-char="&gt;"
            data-placeholder="Run a command"
        ></command-palette-mode>
        <command-palette-mode
          data-char=""
            data-scope-types="[&quot;&quot;]"
            data-placeholder="Search or jump to..."
        ></command-palette-mode>
        <command-palette-mode
          data-char=""
            data-scope-types="[&quot;owner&quot;]"
            data-placeholder="Search or jump to..."
        ></command-palette-mode>
      <command-palette-mode
        class="js-command-palette-default-mode"
        data-char=""
        data-placeholder="Search or jump to..."
      ></command-palette-mode>

      <command-palette-input placeholder="Search or jump to..."

        data-action="
          command-palette-input:command-palette#onInput
          command-palette-select:command-palette#onSelect
          command-palette-descope:command-palette#onDescope
          command-palette-cleared:command-palette#onInputClear
        "
      >
        <div class="js-search-icon d-flex flex-items-center mr-2" style="height: 26px">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-search color-fg-muted">
    <path d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z"></path>
</svg>
        </div>
        <div class="js-spinner d-flex flex-items-center mr-2 color-fg-muted" hidden>
          <svg aria-label="Loading" class="anim-rotate" viewBox="0 0 16 16" fill="none" width="16" height="16">
            <circle
              cx="8"
              cy="8"
              r="7"
              stroke="currentColor"
              stroke-opacity="0.25"
              stroke-width="2"
              vector-effect="non-scaling-stroke"
            ></circle>
            <path
              d="M15 8a7.002 7.002 0 00-7-7"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              vector-effect="non-scaling-stroke"
            ></path>
          </svg>
        </div>
        <command-palette-scope >
          <div data-target="command-palette-scope.placeholder" hidden class="color-fg-subtle">/&nbsp;&nbsp;<span class="text-semibold color-fg-default">...</span>&nbsp;&nbsp;/&nbsp;&nbsp;</div>
              <command-palette-token
                data-text="HiromiShikata"
                data-id="MDQ6VXNlcjY0NDA4MTE="
                data-type="owner"
                data-value="HiromiShikata"
                data-targets="command-palette-scope.tokens"
                class="color-fg-default text-semibold"
                style="white-space:nowrap;line-height:20px;"
                >HiromiShikata<span class="color-fg-subtle text-normal">&nbsp;&nbsp;/&nbsp;&nbsp;</span></command-palette-token>
              <command-palette-token
                data-text="test-repository"
                data-id="MDEwOlJlcG9zaXRvcnkxNDgyMzMyOTc="
                data-type="repository"
                data-value="test-repository"
                data-targets="command-palette-scope.tokens"
                class="color-fg-default text-semibold"
                style="white-space:nowrap;line-height:20px;"
                >test-repository<span class="color-fg-subtle text-normal">&nbsp;&nbsp;/&nbsp;&nbsp;</span></command-palette-token>
              <command-palette-token
                data-text="Issues #38"
                data-id="I_kwDOCNXcUc6GaFia"
                data-type="issue"
                data-value="Issues #38"
                data-targets="command-palette-scope.tokens"
                class="color-fg-default text-semibold"
                style="white-space:nowrap;line-height:20px;"
                >Issues #38<span class="color-fg-subtle text-normal">&nbsp;&nbsp;/&nbsp;&nbsp;</span></command-palette-token>
        </command-palette-scope>
        <div class="command-palette-input-group flex-1 form-control border-0 box-shadow-none" style="z-index: 0">
          <div class="command-palette-typeahead position-absolute d-flex flex-items-center Truncate">
            <span class="typeahead-segment input-mirror" data-target="command-palette-input.mirror"></span>
            <span class="Truncate-text" data-target="command-palette-input.typeaheadText"></span>
            <span class="typeahead-segment" data-target="command-palette-input.typeaheadPlaceholder"></span>
          </div>
          <input
            class="js-overlay-input typeahead-input d-none"
            disabled
            tabindex="-1"
            aria-label="Hidden input for typeahead"
          >
          <input
            type="text"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
            class="js-input typeahead-input form-control border-0 box-shadow-none input-block width-full no-focus-indicator"
            aria-label="Command palette input"
            aria-haspopup="listbox"
            aria-expanded="false"
            aria-autocomplete="list"
            aria-controls="command-palette-page-stack"
            role="combobox"
            data-action="
              input:command-palette-input#onInput
              keydown:command-palette-input#onKeydown
            "
          >
        </div>
          <div data-view-component="true" class="position-relative d-inline-block">
    <button aria-keyshortcuts="Control+Backspace" data-action="click:command-palette-input#onClear keypress:command-palette-input#onClear" data-target="command-palette-input.clearButton" id="command-palette-clear-button" hidden="hidden" type="button" data-view-component="true" class="btn-octicon command-palette-input-clear-button">      <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-x-circle-fill">
    <path d="M2.343 13.657A8 8 0 1 1 13.658 2.343 8 8 0 0 1 2.343 13.657ZM6.03 4.97a.751.751 0 0 0-1.042.018.751.751 0 0 0-.018 1.042L6.94 8 4.97 9.97a.749.749 0 0 0 .326 1.275.749.749 0 0 0 .734-.215L8 9.06l1.97 1.97a.749.749 0 0 0 1.275-.326.749.749 0 0 0-.215-.734L9.06 8l1.97-1.97a.749.749 0 0 0-.326-1.275.749.749 0 0 0-.734.215L8 6.94Z"></path>
</svg>
</button>    <tool-tip id="tooltip-9dd69939-afb1-4e8c-999b-a90fdc12635e" for="command-palette-clear-button" popover="manual" data-direction="w" data-type="label" data-view-component="true" class="sr-only position-absolute">Clear Command Palette</tool-tip>
</div>
      </command-palette-input>

      <command-palette-page-stack
        data-default-scope-id="I_kwDOCNXcUc6GaFia"
        data-default-scope-type="Issue"
        data-action="command-palette-page-octicons-cached:command-palette-page-stack#cacheOcticons"
      >
          <command-palette-tip
            class="color-fg-muted f6 px-3 py-1 my-2"
              data-scope-types="[&quot;&quot;,&quot;owner&quot;,&quot;repository&quot;]"
            data-mode=""
            data-value="">
            <div class="d-flex flex-items-start flex-justify-between">
              <div>
                <span class="text-bold">Tip:</span>
                  Type <kbd class="hx_kbd">#</kbd> to search pull requests
              </div>
              <div class="ml-2 flex-shrink-0">
                Type <kbd class="hx_kbd">?</kbd> for help and tips
              </div>
            </div>
          </command-palette-tip>
          <command-palette-tip
            class="color-fg-muted f6 px-3 py-1 my-2"
              data-scope-types="[&quot;&quot;,&quot;owner&quot;,&quot;repository&quot;]"
            data-mode=""
            data-value="">
            <div class="d-flex flex-items-start flex-justify-between">
              <div>
                <span class="text-bold">Tip:</span>
                  Type <kbd class="hx_kbd">#</kbd> to search issues
              </div>
              <div class="ml-2 flex-shrink-0">
                Type <kbd class="hx_kbd">?</kbd> for help and tips
              </div>
            </div>
          </command-palette-tip>
          <command-palette-tip
            class="color-fg-muted f6 px-3 py-1 my-2"
              data-scope-types="[&quot;owner&quot;,&quot;repository&quot;]"
            data-mode=""
            data-value="">
            <div class="d-flex flex-items-start flex-justify-between">
              <div>
                <span class="text-bold">Tip:</span>
                  Type <kbd class="hx_kbd">#</kbd> to search discussions
              </div>
              <div class="ml-2 flex-shrink-0">
                Type <kbd class="hx_kbd">?</kbd> for help and tips
              </div>
            </div>
          </command-palette-tip>
          <command-palette-tip
            class="color-fg-muted f6 px-3 py-1 my-2"
              data-scope-types="[&quot;owner&quot;,&quot;repository&quot;]"
            data-mode=""
            data-value="">
            <div class="d-flex flex-items-start flex-justify-between">
              <div>
                <span class="text-bold">Tip:</span>
                  Type <kbd class="hx_kbd">!</kbd> to search projects
              </div>
              <div class="ml-2 flex-shrink-0">
                Type <kbd class="hx_kbd">?</kbd> for help and tips
              </div>
            </div>
          </command-palette-tip>
          <command-palette-tip
            class="color-fg-muted f6 px-3 py-1 my-2"
              data-scope-types="[&quot;owner&quot;]"
            data-mode=""
            data-value="">
            <div class="d-flex flex-items-start flex-justify-between">
              <div>
                <span class="text-bold">Tip:</span>
                  Type <kbd class="hx_kbd">@</kbd> to search teams
              </div>
              <div class="ml-2 flex-shrink-0">
                Type <kbd class="hx_kbd">?</kbd> for help and tips
              </div>
            </div>
          </command-palette-tip>
          <command-palette-tip
            class="color-fg-muted f6 px-3 py-1 my-2"
              data-scope-types="[&quot;&quot;]"
            data-mode=""
            data-value="">
            <div class="d-flex flex-items-start flex-justify-between">
              <div>
                <span class="text-bold">Tip:</span>
                  Type <kbd class="hx_kbd">@</kbd> to search people and organizations
              </div>
              <div class="ml-2 flex-shrink-0">
                Type <kbd class="hx_kbd">?</kbd> for help and tips
              </div>
            </div>
          </command-palette-tip>
          <command-palette-tip
            class="color-fg-muted f6 px-3 py-1 my-2"
              data-scope-types="[&quot;&quot;,&quot;owner&quot;,&quot;repository&quot;]"
            data-mode=""
            data-value="">
            <div class="d-flex flex-items-start flex-justify-between">
              <div>
                <span class="text-bold">Tip:</span>
                  Type <kbd class="hx_kbd">&gt;</kbd> to activate command mode
              </div>
              <div class="ml-2 flex-shrink-0">
                Type <kbd class="hx_kbd">?</kbd> for help and tips
              </div>
            </div>
          </command-palette-tip>
          <command-palette-tip
            class="color-fg-muted f6 px-3 py-1 my-2"
              data-scope-types="[&quot;&quot;,&quot;owner&quot;,&quot;repository&quot;]"
            data-mode=""
            data-value="">
            <div class="d-flex flex-items-start flex-justify-between">
              <div>
                <span class="text-bold">Tip:</span>
                  Go to your accessibility settings to change your keyboard shortcuts
              </div>
              <div class="ml-2 flex-shrink-0">
                Type <kbd class="hx_kbd">?</kbd> for help and tips
              </div>
            </div>
          </command-palette-tip>
          <command-palette-tip
            class="color-fg-muted f6 px-3 py-1 my-2"
              data-scope-types="[&quot;&quot;,&quot;owner&quot;,&quot;repository&quot;]"
            data-mode="#"
            data-value="">
            <div class="d-flex flex-items-start flex-justify-between">
              <div>
                <span class="text-bold">Tip:</span>
                  Type author:@me to search your content
              </div>
              <div class="ml-2 flex-shrink-0">
                Type <kbd class="hx_kbd">?</kbd> for help and tips
              </div>
            </div>
          </command-palette-tip>
          <command-palette-tip
            class="color-fg-muted f6 px-3 py-1 my-2"
              data-scope-types="[&quot;&quot;,&quot;owner&quot;,&quot;repository&quot;]"
            data-mode="#"
            data-value="">
            <div class="d-flex flex-items-start flex-justify-between">
              <div>
                <span class="text-bold">Tip:</span>
                  Type is:pr to filter to pull requests
              </div>
              <div class="ml-2 flex-shrink-0">
                Type <kbd class="hx_kbd">?</kbd> for help and tips
              </div>
            </div>
          </command-palette-tip>
          <command-palette-tip
            class="color-fg-muted f6 px-3 py-1 my-2"
              data-scope-types="[&quot;&quot;,&quot;owner&quot;,&quot;repository&quot;]"
            data-mode="#"
            data-value="">
            <div class="d-flex flex-items-start flex-justify-between">
              <div>
                <span class="text-bold">Tip:</span>
                  Type is:issue to filter to issues
              </div>
              <div class="ml-2 flex-shrink-0">
                Type <kbd class="hx_kbd">?</kbd> for help and tips
              </div>
            </div>
          </command-palette-tip>
          <command-palette-tip
            class="color-fg-muted f6 px-3 py-1 my-2"
              data-scope-types="[&quot;owner&quot;,&quot;repository&quot;]"
            data-mode="#"
            data-value="">
            <div class="d-flex flex-items-start flex-justify-between">
              <div>
                <span class="text-bold">Tip:</span>
                  Type is:project to filter to projects
              </div>
              <div class="ml-2 flex-shrink-0">
                Type <kbd class="hx_kbd">?</kbd> for help and tips
              </div>
            </div>
          </command-palette-tip>
          <command-palette-tip
            class="color-fg-muted f6 px-3 py-1 my-2"
              data-scope-types="[&quot;&quot;,&quot;owner&quot;,&quot;repository&quot;]"
            data-mode="#"
            data-value="">
            <div class="d-flex flex-items-start flex-justify-between">
              <div>
                <span class="text-bold">Tip:</span>
                  Type is:open to filter to open content
              </div>
              <div class="ml-2 flex-shrink-0">
                Type <kbd class="hx_kbd">?</kbd> for help and tips
              </div>
            </div>
          </command-palette-tip>
        <command-palette-tip class="mx-3 my-2 flash flash-error d-flex flex-items-center" data-scope-types="*" data-on-error>
          <div>
            <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-alert">
    <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"></path>
</svg>
          </div>
          <div class="px-2">
            We’ve encountered an error and some results aren't available at this time. Type a new search or try again later.
          </div>
        </command-palette-tip>
        <command-palette-tip class="h4 color-fg-default pl-3 pb-2 pt-3" data-on-empty data-scope-types="*" data-match-mode="[^?]|^$">
          No results matched your search
        </command-palette-tip>

        <div hidden>

            <div data-targets="command-palette-page-stack.localOcticons" data-octicon-id="arrow-right-color-fg-muted">
              <svg height="16" class="octicon octicon-arrow-right color-fg-muted" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M8.22 2.97a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l2.97-2.97H3.75a.75.75 0 0 1 0-1.5h7.44L8.22 4.03a.75.75 0 0 1 0-1.06Z"></path></svg>
            </div>
            <div data-targets="command-palette-page-stack.localOcticons" data-octicon-id="arrow-right-color-fg-default">
              <svg height="16" class="octicon octicon-arrow-right color-fg-default" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M8.22 2.97a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l2.97-2.97H3.75a.75.75 0 0 1 0-1.5h7.44L8.22 4.03a.75.75 0 0 1 0-1.06Z"></path></svg>
            </div>
            <div data-targets="command-palette-page-stack.localOcticons" data-octicon-id="codespaces-color-fg-muted">
              <svg height="16" class="octicon octicon-codespaces color-fg-muted" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M0 11.25c0-.966.784-1.75 1.75-1.75h12.5c.966 0 1.75.784 1.75 1.75v3A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25Zm2-9.5C2 .784 2.784 0 3.75 0h8.5C13.216 0 14 .784 14 1.75v5a1.75 1.75 0 0 1-1.75 1.75h-8.5A1.75 1.75 0 0 1 2 6.75Zm1.75-.25a.25.25 0 0 0-.25.25v5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-5a.25.25 0 0 0-.25-.25Zm-2 9.5a.25.25 0 0 0-.25.25v3c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25v-3a.25.25 0 0 0-.25-.25Z"></path><path d="M7 12.75a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1-.75-.75Zm-4 0a.75.75 0 0 1 .75-.75h.5a.75.75 0 0 1 0 1.5h-.5a.75.75 0 0 1-.75-.75Z"></path></svg>
            </div>
            <div data-targets="command-palette-page-stack.localOcticons" data-octicon-id="copy-color-fg-muted">
              <svg height="16" class="octicon octicon-copy color-fg-muted" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"></path><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path></svg>
            </div>
            <div data-targets="command-palette-page-stack.localOcticons" data-octicon-id="dash-color-fg-muted">
              <svg height="16" class="octicon octicon-dash color-fg-muted" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M2 7.75A.75.75 0 0 1 2.75 7h10a.75.75 0 0 1 0 1.5h-10A.75.75 0 0 1 2 7.75Z"></path></svg>
            </div>
            <div data-targets="command-palette-page-stack.localOcticons" data-octicon-id="file-color-fg-muted">
              <svg height="16" class="octicon octicon-file color-fg-muted" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z"></path></svg>
            </div>
            <div data-targets="command-palette-page-stack.localOcticons" data-octicon-id="gear-color-fg-muted">
              <svg height="16" class="octicon octicon-gear color-fg-muted" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M8 0a8.2 8.2 0 0 1 .701.031C9.444.095 9.99.645 10.16 1.29l.288 1.107c.018.066.079.158.212.224.231.114.454.243.668.386.123.082.233.09.299.071l1.103-.303c.644-.176 1.392.021 1.82.63.27.385.506.792.704 1.218.315.675.111 1.422-.364 1.891l-.814.806c-.049.048-.098.147-.088.294.016.257.016.515 0 .772-.01.147.038.246.088.294l.814.806c.475.469.679 1.216.364 1.891a7.977 7.977 0 0 1-.704 1.217c-.428.61-1.176.807-1.82.63l-1.102-.302c-.067-.019-.177-.011-.3.071a5.909 5.909 0 0 1-.668.386c-.133.066-.194.158-.211.224l-.29 1.106c-.168.646-.715 1.196-1.458 1.26a8.006 8.006 0 0 1-1.402 0c-.743-.064-1.289-.614-1.458-1.26l-.289-1.106c-.018-.066-.079-.158-.212-.224a5.738 5.738 0 0 1-.668-.386c-.123-.082-.233-.09-.299-.071l-1.103.303c-.644.176-1.392-.021-1.82-.63a8.12 8.12 0 0 1-.704-1.218c-.315-.675-.111-1.422.363-1.891l.815-.806c.05-.048.098-.147.088-.294a6.214 6.214 0 0 1 0-.772c.01-.147-.038-.246-.088-.294l-.815-.806C.635 6.045.431 5.298.746 4.623a7.92 7.92 0 0 1 .704-1.217c.428-.61 1.176-.807 1.82-.63l1.102.302c.067.019.177.011.3-.071.214-.143.437-.272.668-.386.133-.066.194-.158.211-.224l.29-1.106C6.009.645 6.556.095 7.299.03 7.53.01 7.764 0 8 0Zm-.571 1.525c-.036.003-.108.036-.137.146l-.289 1.105c-.147.561-.549.967-.998 1.189-.173.086-.34.183-.5.29-.417.278-.97.423-1.529.27l-1.103-.303c-.109-.03-.175.016-.195.045-.22.312-.412.644-.573.99-.014.031-.021.11.059.19l.815.806c.411.406.562.957.53 1.456a4.709 4.709 0 0 0 0 .582c.032.499-.119 1.05-.53 1.456l-.815.806c-.081.08-.073.159-.059.19.162.346.353.677.573.989.02.03.085.076.195.046l1.102-.303c.56-.153 1.113-.008 1.53.27.161.107.328.204.501.29.447.222.85.629.997 1.189l.289 1.105c.029.109.101.143.137.146a6.6 6.6 0 0 0 1.142 0c.036-.003.108-.036.137-.146l.289-1.105c.147-.561.549-.967.998-1.189.173-.086.34-.183.5-.29.417-.278.97-.423 1.529-.27l1.103.303c.109.029.175-.016.195-.045.22-.313.411-.644.573-.99.014-.031.021-.11-.059-.19l-.815-.806c-.411-.406-.562-.957-.53-1.456a4.709 4.709 0 0 0 0-.582c-.032-.499.119-1.05.53-1.456l.815-.806c.081-.08.073-.159.059-.19a6.464 6.464 0 0 0-.573-.989c-.02-.03-.085-.076-.195-.046l-1.102.303c-.56.153-1.113.008-1.53-.27a4.44 4.44 0 0 0-.501-.29c-.447-.222-.85-.629-.997-1.189l-.289-1.105c-.029-.11-.101-.143-.137-.146a6.6 6.6 0 0 0-1.142 0ZM11 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM9.5 8a1.5 1.5 0 1 0-3.001.001A1.5 1.5 0 0 0 9.5 8Z"></path></svg>
            </div>
            <div data-targets="command-palette-page-stack.localOcticons" data-octicon-id="lock-color-fg-muted">
              <svg height="16" class="octicon octicon-lock color-fg-muted" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M4 4a4 4 0 0 1 8 0v2h.25c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 12.25 15h-8.5A1.75 1.75 0 0 1 2 13.25v-5.5C2 6.784 2.784 6 3.75 6H4Zm8.25 3.5h-8.5a.25.25 0 0 0-.25.25v5.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-5.5a.25.25 0 0 0-.25-.25ZM10.5 6V4a2.5 2.5 0 1 0-5 0v2Z"></path></svg>
            </div>
            <div data-targets="command-palette-page-stack.localOcticons" data-octicon-id="moon-color-fg-muted">
              <svg height="16" class="octicon octicon-moon color-fg-muted" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M9.598 1.591a.749.749 0 0 1 .785-.175 7.001 7.001 0 1 1-8.967 8.967.75.75 0 0 1 .961-.96 5.5 5.5 0 0 0 7.046-7.046.75.75 0 0 1 .175-.786Zm1.616 1.945a7 7 0 0 1-7.678 7.678 5.499 5.499 0 1 0 7.678-7.678Z"></path></svg>
            </div>
            <div data-targets="command-palette-page-stack.localOcticons" data-octicon-id="person-color-fg-muted">
              <svg height="16" class="octicon octicon-person color-fg-muted" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M10.561 8.073a6.005 6.005 0 0 1 3.432 5.142.75.75 0 1 1-1.498.07 4.5 4.5 0 0 0-8.99 0 .75.75 0 0 1-1.498-.07 6.004 6.004 0 0 1 3.431-5.142 3.999 3.999 0 1 1 5.123 0ZM10.5 5a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"></path></svg>
            </div>
            <div data-targets="command-palette-page-stack.localOcticons" data-octicon-id="pencil-color-fg-muted">
              <svg height="16" class="octicon octicon-pencil color-fg-muted" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Zm.176 4.823L9.75 4.81l-6.286 6.287a.253.253 0 0 0-.064.108l-.558 1.953 1.953-.558a.253.253 0 0 0 .108-.064Zm1.238-3.763a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354Z"></path></svg>
            </div>
            <div data-targets="command-palette-page-stack.localOcticons" data-octicon-id="issue-opened-open">
              <svg height="16" class="octicon octicon-issue-opened open" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"></path><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"></path></svg>
            </div>
            <div data-targets="command-palette-page-stack.localOcticons" data-octicon-id="git-pull-request-draft-color-fg-muted">
              <svg height="16" class="octicon octicon-git-pull-request-draft color-fg-muted" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M3.25 1A2.25 2.25 0 0 1 4 5.372v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.251 2.251 0 0 1 3.25 1Zm9.5 14a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5ZM2.5 3.25a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0ZM3.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm9.5 0a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM14 7.5a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm0-4.25a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Z"></path></svg>
            </div>
            <div data-targets="command-palette-page-stack.localOcticons" data-octicon-id="search-color-fg-muted">
              <svg height="16" class="octicon octicon-search color-fg-muted" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z"></path></svg>
            </div>
            <div data-targets="command-palette-page-stack.localOcticons" data-octicon-id="sun-color-fg-muted">
              <svg height="16" class="octicon octicon-sun color-fg-muted" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M8 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-1.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm5.657-8.157a.75.75 0 0 1 0 1.061l-1.061 1.06a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l1.06-1.06a.75.75 0 0 1 1.06 0Zm-9.193 9.193a.75.75 0 0 1 0 1.06l-1.06 1.061a.75.75 0 1 1-1.061-1.06l1.06-1.061a.75.75 0 0 1 1.061 0ZM8 0a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V.75A.75.75 0 0 1 8 0ZM3 8a.75.75 0 0 1-.75.75H.75a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 3 8Zm13 0a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 16 8Zm-8 5a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 8 13Zm3.536-1.464a.75.75 0 0 1 1.06 0l1.061 1.06a.75.75 0 0 1-1.06 1.061l-1.061-1.06a.75.75 0 0 1 0-1.061ZM2.343 2.343a.75.75 0 0 1 1.061 0l1.06 1.061a.751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018l-1.06-1.06a.75.75 0 0 1 0-1.06Z"></path></svg>
            </div>
            <div data-targets="command-palette-page-stack.localOcticons" data-octicon-id="sync-color-fg-muted">
              <svg height="16" class="octicon octicon-sync color-fg-muted" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M1.705 8.005a.75.75 0 0 1 .834.656 5.5 5.5 0 0 0 9.592 2.97l-1.204-1.204a.25.25 0 0 1 .177-.427h3.646a.25.25 0 0 1 .25.25v3.646a.25.25 0 0 1-.427.177l-1.38-1.38A7.002 7.002 0 0 1 1.05 8.84a.75.75 0 0 1 .656-.834ZM8 2.5a5.487 5.487 0 0 0-4.131 1.869l1.204 1.204A.25.25 0 0 1 4.896 6H1.25A.25.25 0 0 1 1 5.75V2.104a.25.25 0 0 1 .427-.177l1.38 1.38A7.002 7.002 0 0 1 14.95 7.16a.75.75 0 0 1-1.49.178A5.5 5.5 0 0 0 8 2.5Z"></path></svg>
            </div>
            <div data-targets="command-palette-page-stack.localOcticons" data-octicon-id="trash-color-fg-muted">
              <svg height="16" class="octicon octicon-trash color-fg-muted" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.575l-.66-6.6a.75.75 0 1 1 1.492-.15ZM6.5 1.75V3h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25Z"></path></svg>
            </div>
            <div data-targets="command-palette-page-stack.localOcticons" data-octicon-id="key-color-fg-muted">
              <svg height="16" class="octicon octicon-key color-fg-muted" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M10.5 0a5.499 5.499 0 1 1-1.288 10.848l-.932.932a.749.749 0 0 1-.53.22H7v.75a.749.749 0 0 1-.22.53l-.5.5a.749.749 0 0 1-.53.22H5v.75a.749.749 0 0 1-.22.53l-.5.5a.749.749 0 0 1-.53.22h-2A1.75 1.75 0 0 1 0 14.25v-2c0-.199.079-.389.22-.53l4.932-4.932A5.5 5.5 0 0 1 10.5 0Zm-4 5.5c-.001.431.069.86.205 1.269a.75.75 0 0 1-.181.768L1.5 12.56v1.69c0 .138.112.25.25.25h1.69l.06-.06v-1.19a.75.75 0 0 1 .75-.75h1.19l.06-.06v-1.19a.75.75 0 0 1 .75-.75h1.19l1.023-1.025a.75.75 0 0 1 .768-.18A4 4 0 1 0 6.5 5.5ZM11 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path></svg>
            </div>
            <div data-targets="command-palette-page-stack.localOcticons" data-octicon-id="comment-discussion-color-fg-muted">
              <svg height="16" class="octicon octicon-comment-discussion color-fg-muted" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M1.75 1h8.5c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 10.25 10H7.061l-2.574 2.573A1.458 1.458 0 0 1 2 11.543V10h-.25A1.75 1.75 0 0 1 0 8.25v-5.5C0 1.784.784 1 1.75 1ZM1.5 2.75v5.5c0 .138.112.25.25.25h1a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h3.5a.25.25 0 0 0 .25-.25v-5.5a.25.25 0 0 0-.25-.25h-8.5a.25.25 0 0 0-.25.25Zm13 2a.25.25 0 0 0-.25-.25h-.5a.75.75 0 0 1 0-1.5h.5c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 14.25 12H14v1.543a1.458 1.458 0 0 1-2.487 1.03L9.22 12.28a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215l2.22 2.22v-2.19a.75.75 0 0 1 .75-.75h1a.25.25 0 0 0 .25-.25Z"></path></svg>
            </div>
            <div data-targets="command-palette-page-stack.localOcticons" data-octicon-id="bell-color-fg-muted">
              <svg height="16" class="octicon octicon-bell color-fg-muted" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M8 16a2 2 0 0 0 1.985-1.75c.017-.137-.097-.25-.235-.25h-3.5c-.138 0-.252.113-.235.25A2 2 0 0 0 8 16ZM3 5a5 5 0 0 1 10 0v2.947c0 .05.015.098.042.139l1.703 2.555A1.519 1.519 0 0 1 13.482 13H2.518a1.516 1.516 0 0 1-1.263-2.36l1.703-2.554A.255.255 0 0 0 3 7.947Zm5-3.5A3.5 3.5 0 0 0 4.5 5v2.947c0 .346-.102.683-.294.97l-1.703 2.556a.017.017 0 0 0-.003.01l.001.006c0 .002.002.004.004.006l.006.004.007.001h10.964l.007-.001.006-.004.004-.006.001-.007a.017.017 0 0 0-.003-.01l-1.703-2.554a1.745 1.745 0 0 1-.294-.97V5A3.5 3.5 0 0 0 8 1.5Z"></path></svg>
            </div>
            <div data-targets="command-palette-page-stack.localOcticons" data-octicon-id="bell-slash-color-fg-muted">
              <svg height="16" class="octicon octicon-bell-slash color-fg-muted" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="m4.182 4.31.016.011 10.104 7.316.013.01 1.375.996a.75.75 0 1 1-.88 1.214L13.626 13H2.518a1.516 1.516 0 0 1-1.263-2.36l1.703-2.554A.255.255 0 0 0 3 7.947V5.305L.31 3.357a.75.75 0 1 1 .88-1.214Zm7.373 7.19L4.5 6.391v1.556c0 .346-.102.683-.294.97l-1.703 2.556a.017.017 0 0 0-.003.01c0 .005.002.009.005.012l.006.004.007.001ZM8 1.5c-.997 0-1.895.416-2.534 1.086A.75.75 0 1 1 4.38 1.55 5 5 0 0 1 13 5v2.373a.75.75 0 0 1-1.5 0V5A3.5 3.5 0 0 0 8 1.5ZM8 16a2 2 0 0 1-1.985-1.75c-.017-.137.097-.25.235-.25h3.5c.138 0 .252.113.235.25A2 2 0 0 1 8 16Z"></path></svg>
            </div>
            <div data-targets="command-palette-page-stack.localOcticons" data-octicon-id="paintbrush-color-fg-muted">
              <svg height="16" class="octicon octicon-paintbrush color-fg-muted" viewBox="0 0 16 16" version="1.1" width="16" aria-hidden="true"><path d="M11.134 1.535c.7-.509 1.416-.942 2.076-1.155.649-.21 1.463-.267 2.069.34.603.601.568 1.411.368 2.07-.202.668-.624 1.39-1.125 2.096-1.011 1.424-2.496 2.987-3.775 4.249-1.098 1.084-2.132 1.839-3.04 2.3a3.744 3.744 0 0 1-1.055 3.217c-.431.431-1.065.691-1.657.861-.614.177-1.294.287-1.914.357A21.151 21.151 0 0 1 .797 16H.743l.007-.75H.749L.742 16a.75.75 0 0 1-.743-.742l.743-.008-.742.007v-.054a21.25 21.25 0 0 1 .13-2.284c.067-.647.187-1.287.358-1.914.17-.591.43-1.226.86-1.657a3.746 3.746 0 0 1 3.227-1.054c.466-.893 1.225-1.907 2.314-2.982 1.271-1.255 2.833-2.75 4.245-3.777ZM1.62 13.089c-.051.464-.086.929-.104 1.395.466-.018.932-.053 1.396-.104a10.511 10.511 0 0 0 1.668-.309c.526-.151.856-.325 1.011-.48a2.25 2.25 0 1 0-3.182-3.182c-.155.155-.329.485-.48 1.01a10.515 10.515 0 0 0-.309 1.67Zm10.396-10.34c-1.224.89-2.605 2.189-3.822 3.384l1.718 1.718c1.21-1.205 2.51-2.597 3.387-3.833.47-.662.78-1.227.912-1.662.134-.444.032-.551.009-.575h-.001V1.78c-.014-.014-.113-.113-.548.027-.432.14-.995.462-1.655.942Zm-4.832 7.266-.001.001a9.859 9.859 0 0 0 1.63-1.142L7.155 7.216a9.7 9.7 0 0 0-1.161 1.607c.482.302.889.71 1.19 1.192Z"></path></svg>
            </div>

            <command-palette-item-group
              data-group-id="top"
              data-group-title="Top result"
              data-group-hint=""
              data-group-limits="{}"
              data-default-priority="0"
            >
            </command-palette-item-group>
            <command-palette-item-group
              data-group-id="commands"
              data-group-title="Commands"
              data-group-hint="Type &gt; to filter"
              data-group-limits="{&quot;static_items_page&quot;:50,&quot;issue&quot;:50,&quot;pull_request&quot;:50,&quot;discussion&quot;:50}"
              data-default-priority="1"
            >
            </command-palette-item-group>
            <command-palette-item-group
              data-group-id="global_commands"
              data-group-title="Global Commands"
              data-group-hint="Type &gt; to filter"
              data-group-limits="{&quot;issue&quot;:0,&quot;pull_request&quot;:0,&quot;discussion&quot;:0}"
              data-default-priority="2"
            >
            </command-palette-item-group>
            <command-palette-item-group
              data-group-id="this_page"
              data-group-title="This Page"
              data-group-hint=""
              data-group-limits="{}"
              data-default-priority="3"
            >
            </command-palette-item-group>
            <command-palette-item-group
              data-group-id="files"
              data-group-title="Files"
              data-group-hint=""
              data-group-limits="{}"
              data-default-priority="4"
            >
            </command-palette-item-group>
            <command-palette-item-group
              data-group-id="default"
              data-group-title="Default"
              data-group-hint=""
              data-group-limits="{&quot;static_items_page&quot;:50}"
              data-default-priority="5"
            >
            </command-palette-item-group>
            <command-palette-item-group
              data-group-id="pages"
              data-group-title="Pages"
              data-group-hint=""
              data-group-limits="{&quot;repository&quot;:10}"
              data-default-priority="6"
            >
            </command-palette-item-group>
            <command-palette-item-group
              data-group-id="access_policies"
              data-group-title="Access Policies"
              data-group-hint=""
              data-group-limits="{}"
              data-default-priority="7"
            >
            </command-palette-item-group>
            <command-palette-item-group
              data-group-id="organizations"
              data-group-title="Organizations"
              data-group-hint=""
              data-group-limits="{}"
              data-default-priority="8"
            >
            </command-palette-item-group>
            <command-palette-item-group
              data-group-id="repositories"
              data-group-title="Repositories"
              data-group-hint=""
              data-group-limits="{}"
              data-default-priority="9"
            >
            </command-palette-item-group>
            <command-palette-item-group
              data-group-id="references"
              data-group-title="Issues, pull requests, and discussions"
              data-group-hint="Type # to filter"
              data-group-limits="{}"
              data-default-priority="10"
            >
            </command-palette-item-group>
            <command-palette-item-group
              data-group-id="teams"
              data-group-title="Teams"
              data-group-hint=""
              data-group-limits="{}"
              data-default-priority="11"
            >
            </command-palette-item-group>
            <command-palette-item-group
              data-group-id="users"
              data-group-title="Users"
              data-group-hint=""
              data-group-limits="{}"
              data-default-priority="12"
            >
            </command-palette-item-group>
            <command-palette-item-group
              data-group-id="memex_projects"
              data-group-title="Projects"
              data-group-hint=""
              data-group-limits="{}"
              data-default-priority="13"
            >
            </command-palette-item-group>
            <command-palette-item-group
              data-group-id="projects"
              data-group-title="Projects (classic)"
              data-group-hint=""
              data-group-limits="{}"
              data-default-priority="14"
            >
            </command-palette-item-group>
            <command-palette-item-group
              data-group-id="footer"
              data-group-title="Footer"
              data-group-hint=""
              data-group-limits="{}"
              data-default-priority="15"
            >
            </command-palette-item-group>
            <command-palette-item-group
              data-group-id="modes_help"
              data-group-title="Modes"
              data-group-hint=""
              data-group-limits="{}"
              data-default-priority="16"
            >
            </command-palette-item-group>
            <command-palette-item-group
              data-group-id="filters_help"
              data-group-title="Use filters in issues, pull requests, discussions, and projects"
              data-group-hint=""
              data-group-limits="{}"
              data-default-priority="17"
            >
            </command-palette-item-group>

            <command-palette-page
              data-page-title="HiromiShikata"
              data-scope-id="MDQ6VXNlcjY0NDA4MTE="
              data-scope-type="owner"
              data-targets="command-palette-page-stack.defaultPages"
              hidden
            >
            </command-palette-page>
            <command-palette-page
              data-page-title="test-repository"
              data-scope-id="MDEwOlJlcG9zaXRvcnkxNDgyMzMyOTc="
              data-scope-type="repository"
              data-targets="command-palette-page-stack.defaultPages"
              hidden
            >
            </command-palette-page>
            <command-palette-page
              data-page-title="Issues #38"
              data-scope-id="I_kwDOCNXcUc6GaFia"
              data-scope-type="issue"
              data-targets="command-palette-page-stack.defaultPages"
              hidden
            >
            </command-palette-page>
        </div>

        <command-palette-page data-is-root>
        </command-palette-page>
          <command-palette-page
            data-page-title="HiromiShikata"
            data-scope-id="MDQ6VXNlcjY0NDA4MTE="
            data-scope-type="owner"
          >
          </command-palette-page>
          <command-palette-page
            data-page-title="test-repository"
            data-scope-id="MDEwOlJlcG9zaXRvcnkxNDgyMzMyOTc="
            data-scope-type="repository"
          >
          </command-palette-page>
          <command-palette-page
            data-page-title="Issues #38"
            data-scope-id="I_kwDOCNXcUc6GaFia"
            data-scope-type="issue"
          >
          </command-palette-page>
      </command-palette-page-stack>

      <server-defined-provider data-type="search-links" data-targets="command-palette.serverDefinedProviderElements"></server-defined-provider>
      <server-defined-provider data-type="help" data-targets="command-palette.serverDefinedProviderElements">
          <command-palette-help
            data-group="modes_help"
              data-prefix="#"
              data-scope-types="[&quot;&quot;]"
          >
            <span data-target="command-palette-help.titleElement">Search for <strong>issues</strong> and <strong>pull requests</strong></span>
              <span data-target="command-palette-help.hintElement">
                <kbd class="hx_kbd">#</kbd>
              </span>
          </command-palette-help>
          <command-palette-help
            data-group="modes_help"
              data-prefix="#"
              data-scope-types="[&quot;owner&quot;,&quot;repository&quot;]"
          >
            <span data-target="command-palette-help.titleElement">Search for <strong>issues, pull requests, discussions,</strong> and <strong>projects</strong></span>
              <span data-target="command-palette-help.hintElement">
                <kbd class="hx_kbd">#</kbd>
              </span>
          </command-palette-help>
          <command-palette-help
            data-group="modes_help"
              data-prefix="@"
              data-scope-types="[&quot;&quot;]"
          >
            <span data-target="command-palette-help.titleElement">Search for <strong>organizations, repositories,</strong> and <strong>users</strong></span>
              <span data-target="command-palette-help.hintElement">
                <kbd class="hx_kbd">@</kbd>
              </span>
          </command-palette-help>
          <command-palette-help
            data-group="modes_help"
              data-prefix="!"
              data-scope-types="[&quot;owner&quot;,&quot;repository&quot;]"
          >
            <span data-target="command-palette-help.titleElement">Search for <strong>projects</strong></span>
              <span data-target="command-palette-help.hintElement">
                <kbd class="hx_kbd">!</kbd>
              </span>
          </command-palette-help>
          <command-palette-help
            data-group="modes_help"
              data-prefix="/"
              data-scope-types="[&quot;repository&quot;]"
          >
            <span data-target="command-palette-help.titleElement">Search for <strong>files</strong></span>
              <span data-target="command-palette-help.hintElement">
                <kbd class="hx_kbd">/</kbd>
              </span>
          </command-palette-help>
          <command-palette-help
            data-group="modes_help"
              data-prefix="&gt;"
          >
            <span data-target="command-palette-help.titleElement">Activate <strong>command mode</strong></span>
              <span data-target="command-palette-help.hintElement">
                <kbd class="hx_kbd">&gt;</kbd>
              </span>
          </command-palette-help>
          <command-palette-help
            data-group="filters_help"
              data-prefix="# author:@me"
          >
            <span data-target="command-palette-help.titleElement">Search your issues, pull requests, and discussions</span>
              <span data-target="command-palette-help.hintElement">
                <kbd class="hx_kbd"># author:@me</kbd>
              </span>
          </command-palette-help>
          <command-palette-help
            data-group="filters_help"
              data-prefix="# author:@me"
          >
            <span data-target="command-palette-help.titleElement">Search your issues, pull requests, and discussions</span>
              <span data-target="command-palette-help.hintElement">
                <kbd class="hx_kbd"># author:@me</kbd>
              </span>
          </command-palette-help>
          <command-palette-help
            data-group="filters_help"
              data-prefix="# is:pr"
          >
            <span data-target="command-palette-help.titleElement">Filter to pull requests</span>
              <span data-target="command-palette-help.hintElement">
                <kbd class="hx_kbd"># is:pr</kbd>
              </span>
          </command-palette-help>
          <command-palette-help
            data-group="filters_help"
              data-prefix="# is:issue"
          >
            <span data-target="command-palette-help.titleElement">Filter to issues</span>
              <span data-target="command-palette-help.hintElement">
                <kbd class="hx_kbd"># is:issue</kbd>
              </span>
          </command-palette-help>
          <command-palette-help
            data-group="filters_help"
              data-prefix="# is:discussion"
              data-scope-types="[&quot;owner&quot;,&quot;repository&quot;]"
          >
            <span data-target="command-palette-help.titleElement">Filter to discussions</span>
              <span data-target="command-palette-help.hintElement">
                <kbd class="hx_kbd"># is:discussion</kbd>
              </span>
          </command-palette-help>
          <command-palette-help
            data-group="filters_help"
              data-prefix="# is:project"
              data-scope-types="[&quot;owner&quot;,&quot;repository&quot;]"
          >
            <span data-target="command-palette-help.titleElement">Filter to projects</span>
              <span data-target="command-palette-help.hintElement">
                <kbd class="hx_kbd"># is:project</kbd>
              </span>
          </command-palette-help>
          <command-palette-help
            data-group="filters_help"
              data-prefix="# is:open"
          >
            <span data-target="command-palette-help.titleElement">Filter to open issues, pull requests, and discussions</span>
              <span data-target="command-palette-help.hintElement">
                <kbd class="hx_kbd"># is:open</kbd>
              </span>
          </command-palette-help>
      </server-defined-provider>

        <server-defined-provider
          data-type="commands"
          data-fetch-debounce="0"
            data-src="/command_palette/commands"
          data-supported-modes="[]"
            data-supports-commands
          
          data-targets="command-palette.serverDefinedProviderElements"
          ></server-defined-provider>
        <server-defined-provider
          data-type="prefetched"
          data-fetch-debounce="0"
            data-src="/command_palette/jump_to_page_navigation"
          data-supported-modes="[&quot;&quot;]"
            data-supported-scope-types="[&quot;&quot;,&quot;owner&quot;,&quot;repository&quot;]"
          
          data-targets="command-palette.serverDefinedProviderElements"
          ></server-defined-provider>
        <server-defined-provider
          data-type="remote"
          data-fetch-debounce="200"
            data-src="/command_palette/issues"
          data-supported-modes="[&quot;#&quot;,&quot;#&quot;]"
            data-supported-scope-types="[&quot;owner&quot;,&quot;repository&quot;,&quot;&quot;]"
          
          data-targets="command-palette.serverDefinedProviderElements"
          ></server-defined-provider>
        <server-defined-provider
          data-type="remote"
          data-fetch-debounce="200"
            data-src="/command_palette/jump_to"
          data-supported-modes="[&quot;@&quot;,&quot;@&quot;]"
            data-supported-scope-types="[&quot;&quot;,&quot;owner&quot;]"
          
          data-targets="command-palette.serverDefinedProviderElements"
          ></server-defined-provider>
        <server-defined-provider
          data-type="remote"
          data-fetch-debounce="200"
            data-src="/command_palette/jump_to_members_only"
          data-supported-modes="[&quot;@&quot;,&quot;@&quot;,&quot;&quot;,&quot;&quot;]"
            data-supported-scope-types="[&quot;&quot;,&quot;owner&quot;]"
          
          data-targets="command-palette.serverDefinedProviderElements"
          ></server-defined-provider>
        <server-defined-provider
          data-type="prefetched"
          data-fetch-debounce="0"
            data-src="/command_palette/jump_to_members_only_prefetched"
          data-supported-modes="[&quot;@&quot;,&quot;@&quot;,&quot;&quot;,&quot;&quot;]"
            data-supported-scope-types="[&quot;&quot;,&quot;owner&quot;]"
          
          data-targets="command-palette.serverDefinedProviderElements"
          ></server-defined-provider>
        <server-defined-provider
          data-type="files"
          data-fetch-debounce="0"
            data-src="/command_palette/files"
          data-supported-modes="[&quot;/&quot;]"
            data-supported-scope-types="[&quot;repository&quot;]"
          
          data-targets="command-palette.serverDefinedProviderElements"
          ></server-defined-provider>
        <server-defined-provider
          data-type="remote"
          data-fetch-debounce="200"
            data-src="/command_palette/discussions"
          data-supported-modes="[&quot;#&quot;]"
            data-supported-scope-types="[&quot;owner&quot;,&quot;repository&quot;]"
          
          data-targets="command-palette.serverDefinedProviderElements"
          ></server-defined-provider>
        <server-defined-provider
          data-type="remote"
          data-fetch-debounce="200"
            data-src="/command_palette/projects"
          data-supported-modes="[&quot;#&quot;,&quot;!&quot;]"
            data-supported-scope-types="[&quot;owner&quot;,&quot;repository&quot;]"
          
          data-targets="command-palette.serverDefinedProviderElements"
          ></server-defined-provider>
        <server-defined-provider
          data-type="prefetched"
          data-fetch-debounce="0"
            data-src="/command_palette/recent_issues"
          data-supported-modes="[&quot;#&quot;,&quot;#&quot;]"
            data-supported-scope-types="[&quot;owner&quot;,&quot;repository&quot;,&quot;&quot;]"
          
          data-targets="command-palette.serverDefinedProviderElements"
          ></server-defined-provider>
        <server-defined-provider
          data-type="remote"
          data-fetch-debounce="200"
            data-src="/command_palette/teams"
          data-supported-modes="[&quot;@&quot;,&quot;&quot;]"
            data-supported-scope-types="[&quot;owner&quot;]"
          
          data-targets="command-palette.serverDefinedProviderElements"
          ></server-defined-provider>
        <server-defined-provider
          data-type="remote"
          data-fetch-debounce="200"
            data-src="/command_palette/name_with_owner_repository"
          data-supported-modes="[&quot;@&quot;,&quot;@&quot;,&quot;&quot;,&quot;&quot;]"
            data-supported-scope-types="[&quot;&quot;,&quot;owner&quot;]"
          
          data-targets="command-palette.serverDefinedProviderElements"
          ></server-defined-provider>
    </command-palette>
  </details-dialog>
</details>

<div class="position-fixed bottom-0 left-0 ml-5 mb-5 js-command-palette-toasts" style="z-index: 1000">
  <div hidden class="Toast Toast--loading">
    <span class="Toast-icon">
      <svg class="Toast--spinner" viewBox="0 0 32 32" width="18" height="18" aria-hidden="true">
        <path
          fill="#959da5"
          d="M16 0 A16 16 0 0 0 16 32 A16 16 0 0 0 16 0 M16 4 A12 12 0 0 1 16 28 A12 12 0 0 1 16 4"
        />
        <path fill="#ffffff" d="M16 0 A16 16 0 0 1 32 16 L28 16 A12 12 0 0 0 16 4z"></path>
      </svg>
    </span>
    <span class="Toast-content"></span>
  </div>

  <div hidden class="anim-fade-in fast Toast Toast--error">
    <span class="Toast-icon">
      <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-stop">
    <path d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path>
</svg>
    </span>
    <span class="Toast-content"></span>
  </div>

  <div hidden class="anim-fade-in fast Toast Toast--warning">
    <span class="Toast-icon">
      <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-alert">
    <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"></path>
</svg>
    </span>
    <span class="Toast-content"></span>
  </div>


  <div hidden class="anim-fade-in fast Toast Toast--success">
    <span class="Toast-icon">
      <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-check">
    <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path>
</svg>
    </span>
    <span class="Toast-content"></span>
  </div>

  <div hidden class="anim-fade-in fast Toast">
    <span class="Toast-icon">
      <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-info">
    <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path>
</svg>
    </span>
    <span class="Toast-content"></span>
  </div>
</div>


  <div
    class="application-main "
    data-commit-hovercards-enabled
    data-discussion-hovercards-enabled
    data-issue-and-pr-hovercards-enabled
  >
        <div itemscope itemtype="http://schema.org/SoftwareSourceCode" class="">
    <main id="js-repo-pjax-container" >
      
  


  
      






    
  <div id="repository-container-header" data-turbo-replace hidden></div>




<turbo-frame id="repo-content-turbo-frame" target="_top" data-turbo-action="advance" class="">
    <div id="repo-content-pjax-container" class="repository-content " >
    



    
      
    <div class="clearfix new-discussion-timeline js-check-all-container container-xl px-3 px-md-4 px-lg-5 mt-4" data-pjax="" data-turbo-frame="">
      
    
        <div id="show_issue"
            class="js-issues-results js-socket-channel js-updatable-content"
            data-morpheus-enabled="false"
            data-channel="eyJjIjoiaXNzdWU6MjI1NDk4NTM3MDp0aW1lbGluZSIsInQiOjE3MTM2OTY0MTZ9--e09092051799f5610ea9c135255d974ac8992c9166e9209be58bf9745c448b11">

            

  <div
    id="partial-discussion-header"
    class="gh-header mb-3 js-details-container Details js-socket-channel js-updatable-content issue"
    data-channel="eyJjIjoiaXNzdWU6MjI1NDk4NTM3MCIsInQiOjE3MTM2OTY0MTZ9--607be4872015f7956def485e4f24a9291857cbb6b2944964b7cdc4b0495a44e0"
    data-url="/HiromiShikata/test-repository/issues/38/show_partial?partial=issues%2Ftitle&amp;sticky=true"
    data-gid="I_kwDOCNXcUc6GaFia">

  <div class="gh-header-show ">
    <div class="d-flex flex-column flex-md-row">
      <div class="gh-header-actions mt-0 mb-3 mb-md-2 ml-1 flex-md-order-1 flex-shrink-0 d-flex flex-items-center gap-1">
          <button aria-expanded="false" aria-label="Edit Issue title" data-ga-click="Issues, edit issue, view:issue_show location:issue_header style:button logged_in:true" type="button" data-view-component="true" class="js-details-target js-title-edit-button flex-md-order-2 Button--secondary Button--small Button m-0 mr-md-0">  <span class="Button-content">
    <span class="Button-label">Edit</span>
  </span>
</button>




              <a data-hotkey="c" data-ga-click="Issues, create new issue, view:issue_show location:issue_header style:button logged_in:true" href="/HiromiShikata/test-repository/issues/new/choose" data-view-component="true" class="flex-md-order-2 Button--primary Button--small Button">  <span class="Button-content">
    <span class="Button-label">New issue</span>
  </span>
</a>

        <div class="flex-auto text-right d-block d-md-none">
          <a href="#issue-comment-box" class="py-1">Jump to bottom</a>
        </div>
      </div>

    <h1 class="gh-header-title mb-2 lh-condensed f1 mr-0 flex-auto wb-break-word">
      <bdi class="js-issue-title markdown-title">In progress test title</bdi>
      <span class="f1-light color-fg-muted">#38</span>
    </h1>
    </div>
  </div>

    <div class="gh-header-edit mb-2 position-relative">
      <!-- '"\` --><!-- </textarea></xmp> --></option></form><form data-turbo="false" class="js-issue-update js-comment d-flex flex-column flex-md-row" id="edit_header_2254985370" action="/HiromiShikata/test-repository/issues/38" accept-charset="UTF-8" method="post"><input type="hidden" name="_method" value="put" autocomplete="off" /><input type="hidden" name="authenticity_token" value="3WscL8l6WoKWW7kzrKijOoMllkjVYBatODf4ke9XbXMuWcDnYWvqxIO-dXqjB1c6V_iEQSBC5DYnLxPay6PaYw" />
        <text-expander keys=":" data-emoji-url="/autocomplete/emoji" class="flex-auto d-flex">
          <input class="form-control js-quick-submit flex-auto input-lg input-contrast mr-0 mr-md-2" autofocus="autofocus" autocomplete="off" aria-label="Issue title" type="text" value="In progress test title" name="issue[title]" id="issue_title" />
        </text-expander>
        <div class="mt-2 mt-md-0 d-inline-flex gap-1">
          <button data-disable-with="Updating" data-ga-click="Issues, edit issue save, view:issue_show location:issue_header style:button logged_in:true" type="submit" data-view-component="true" class="Button--secondary Button--medium Button">  <span class="Button-content">
    <span class="Button-label">Save</span>
  </span>
</button>

          <button aria-expanded="true" data-ga-click="Issues, edit issue cancel, view:issue_show location:issue_header style:button logged_in:true" type="button" data-view-component="true" class="js-details-target js-cancel-issue-edit Button--invisible Button--medium Button Button--invisible-noVisuals">  <span class="Button-content">
    <span class="Button-label">Cancel</span>
  </span>
</button>

        </div>
</form>      <div class="comment-form-error js-comment-form-error" role="alert" hidden></div>
    </div>
  <div class="d-flex flex-items-center flex-wrap mt-0 gh-header-meta">
    <div class="flex-shrink-0 mb-2 flex-self-start flex-md-self-center">
        <span title="Status: Open" data-view-component="true" class="State State--open d-flex flex-items-center">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-issue-opened flex-items-center mr-1">
    <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"></path><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"></path>
</svg>
  Open
</span>
    </div>

      <div class="mb-2 flex-shrink-0">
          <div>
      <tracked-issues-progress data-total="1" data-completed="0" data-type="checklist">
  <div class="d-flex flex-row flex-items-center mr-2 border" style="border-radius: 40px; padding: 5px 12px; height: 32px">
      <span  data-target="tracked-issues-progress.checklist" style='display: inline'>
        <svg width="16" height="16" style="display: block" aria-hidden="true" viewBox="0 0 16 16" version="1.1" data-view-component="true" class="octicon octicon-checklist">
    <path d="M2.5 1.75v11.5c0 .138.112.25.25.25h3.17a.75.75 0 0 1 0 1.5H2.75A1.75 1.75 0 0 1 1 13.25V1.75C1 .784 1.784 0 2.75 0h8.5C12.216 0 13 .784 13 1.75v7.736a.75.75 0 0 1-1.5 0V1.75a.25.25 0 0 0-.25-.25h-8.5a.25.25 0 0 0-.25.25Zm13.274 9.537v-.001l-4.557 4.45a.75.75 0 0 1-1.055-.008l-1.943-1.95a.75.75 0 0 1 1.062-1.058l1.419 1.425 4.026-3.932a.75.75 0 1 1 1.048 1.074ZM4.75 4h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM4 7.75A.75.75 0 0 1 4.75 7h2a.75.75 0 0 1 0 1.5h-2A.75.75 0 0 1 4 7.75Z"></path>
</svg>
      </span>
      
<span style="transform:rotate(-90deg); width:16px; height:16px; display: none">
  <svg
    width=16
    height=16
    data-target="tracked-issues-progress.progress"
    data-circumference="38"
     
    >
    <circle
      stroke=var(--borderColor-accent-muted, var(--color-accent-subtle))
      stroke-width=3
      fill="transparent"
      cx="50%"
      cy="50%"
      r=6
      
    />
    <circle
      data-target="tracked-issues-progress.stroke"
      style="transition: stroke-dashoffset 0.35s; transform: rotate(7.105263157894736deg); transform-origin: center"
      stroke="var(--fgColor-accent, var(--color-accent-fg))"
      stroke-width="3"
      stroke-dasharray=38
      stroke-dashoffset=39.5
      stroke-linecap="round"
      fill="transparent"
      cx="50%"
      cy="50%"
      r=6
      
    />
  </svg>
</span>

    <span class="text-normal no-wrap mr-1 ml-1 lh-condensed-ultra" data-target="tracked-issues-progress.label">1 task</span>
  </div>
</tracked-issues-progress>

  </div>

      </div>


      <div class="flex-shrink-0 mb-2 flex-self-start flex-md-self-center">
          
      </div>

    <div class="flex-auto min-width-0 mb-2">
        <a class="author text-bold Link--secondary" data-hovercard-type="user" data-hovercard-url="/users/HiromiShikata/hovercard" data-octo-click="hovercard-link-click" data-octo-dimensions="link_type:self" href="/HiromiShikata">HiromiShikata</a>  opened this issue
<relative-time datetime="2024-04-21T09:26:54Z" class="no-wrap">Apr 21, 2024</relative-time>
&middot; 1 comment

<span data-issue-and-pr-hovercards-enabled>
  
</span>

    </div>

  </div>





    <div class="js-sticky js-sticky-offset-scroll top-0 gh-header-sticky">
      <div class="sticky-content">
        <div class="d-flex flex-items-center flex-justify-between mt-2">
          <div class="d-flex flex-row flex-items-center min-width-0">
            <div class="mr-2 mb-2 flex-shrink-0">
                <span title="Status: Open" data-view-component="true" class="State State--open d-flex flex-items-center">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-issue-opened flex-items-center mr-1">
    <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"></path><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"></path>
</svg>
  Open
</span>
            </div>


              <div class="mb-2 flex-shrink-0">
                  <div>
      <tracked-issues-progress data-total="1" data-completed="0" data-type="checklist">
  <div class="d-flex flex-row flex-items-center mr-2 border" style="border-radius: 40px; padding: 5px 12px; height: 32px">
      <span  data-target="tracked-issues-progress.checklist" style="display: inline">
        <svg style="display: block" aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-checklist">
    <path d="M2.5 1.75v11.5c0 .138.112.25.25.25h3.17a.75.75 0 0 1 0 1.5H2.75A1.75 1.75 0 0 1 1 13.25V1.75C1 .784 1.784 0 2.75 0h8.5C12.216 0 13 .784 13 1.75v7.736a.75.75 0 0 1-1.5 0V1.75a.25.25 0 0 0-.25-.25h-8.5a.25.25 0 0 0-.25.25Zm13.274 9.537v-.001l-4.557 4.45a.75.75 0 0 1-1.055-.008l-1.943-1.95a.75.75 0 0 1 1.062-1.058l1.419 1.425 4.026-3.932a.75.75 0 1 1 1.048 1.074ZM4.75 4h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM4 7.75A.75.75 0 0 1 4.75 7h2a.75.75 0 0 1 0 1.5h-2A.75.75 0 0 1 4 7.75Z"></path>
</svg>
      </span>
      
<span style="transform:rotate(-90deg); width:12px; height:12px; display: none">
  <svg
    width=12
    height=12
    data-target="tracked-issues-progress.progress"
    data-circumference="31"
     
    >
    <circle
      stroke=var(--borderColor-accent-muted, var(--color-accent-subtle))
      stroke-width=2
      fill="transparent"
      cx="50%"
      cy="50%"
      r=5
      
    />
    <circle
      data-target="tracked-issues-progress.stroke"
      style="transition: stroke-dashoffset 0.35s; transform: rotate(5.806451612903226deg); transform-origin: center"
      stroke="var(--fgColor-accent, var(--color-accent-fg))"
      stroke-width="2"
      stroke-dasharray=31
      stroke-dashoffset=32.0
      stroke-linecap="round"
      fill="transparent"
      cx="50%"
      cy="50%"
      r=5
      
    />
  </svg>
</span>

    <span class="text-normal no-wrap mr-1 ml-1" data-target="tracked-issues-progress.label">1 task</span>
  </div>
</tracked-issues-progress>

  </div>

              </div>

              <div class="mb-2 flex-shrink-0">
                  
              </div>

            <div class="min-width-0 mr-2 mb-2">
              <h1 class="d-flex text-bold f5">
  <a class="js-issue-title css-truncate css-truncate-target Link--primary width-fit markdown-title js-smoothscroll-anchor" href="#top">
    In progress test title
  </a>
  <span class="gh-header-number color-fg-muted pl-1">#38</span>
</h1>

              <div class="meta color-fg-muted css-truncate css-truncate-target d-block width-fit">
                  <a class="author text-bold Link--secondary" data-hovercard-z-index-override="111" data-hovercard-type="user" data-hovercard-url="/users/HiromiShikata/hovercard" data-octo-click="hovercard-link-click" data-octo-dimensions="link_type:self" href="/HiromiShikata">HiromiShikata</a>  opened this issue
<relative-time datetime="2024-04-21T09:26:54Z" class="no-wrap">Apr 21, 2024</relative-time>
&middot; 1 comment

<span data-issue-and-pr-hovercards-enabled>
  
</span>

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="gh-header-shadow color-shadow-small js-notification-shelf-offset-top"></div>
</div>


              <div class="d-block d-md-none border-bottom mb-4 f6">
      <div class="d-flex mb-3">
        <span class="text-bold color-fg-muted col-3 col-sm-2 flex-shrink-0">Assignees</span>
        <div class="min-width-0">
            <a class="no-underline" data-hovercard-type="user" data-hovercard-url="/users/HiromiShikata/hovercard" data-octo-click="hovercard-link-click" data-octo-dimensions="link_type:self" href="/HiromiShikata">
              <img class="avatar avatar-user" src="https://avatars.githubusercontent.com/u/6440811?s=40&amp;v=4" width="20" height="20" alt="@HiromiShikata" />
</a>        </div>
      </div>

      <div class="d-flex mb-3">
        <span class="text-bold color-fg-muted col-3 col-sm-2 flex-shrink-0">Labels</span>
        <div class="min-width-0 d-flex flex-wrap mt-n1">
            
<a id="label-b22fd2" href="/HiromiShikata/test-repository/labels/enhancement" data-name="enhancement" style="--label-r:162;--label-g:238;--label-b:239;--label-h:180;--label-s:70;--label-l:78;" data-view-component="true" class="IssueLabel hx_IssueLabel width-fit mb-1 mr-1">
              <span class="css-truncate css-truncate-target width-fit">enhancement</span>
</a>
  <tool-tip id="tooltip-09890604-d065-4e6d-ba02-cb4d803817a1" for="label-b22fd2" popover="manual" data-direction="s" data-type="description" data-view-component="true" class="sr-only position-absolute">New feature or request</tool-tip>
        </div>
      </div>


  </div>


          <div id="discussion_bucket">
            <div data-view-component="true" class="Layout Layout--flowRow-until-md Layout--sidebarPosition-end Layout--sidebarPosition-flowRow-end">
  <div data-view-component="true" class="Layout-main">                  <h2 class="sr-only">Comments</h2>
<div class="js-quote-selection-container"
     data-quote-markdown=".js-comment-body"
     data-discussion-hovercards-enabled
     data-issue-and-pr-hovercards-enabled
     data-team-hovercards-enabled>

  <div
    class="js-discussion js-socket-channel ml-0 pl-0 ml-md-6 pl-md-3"
    data-channel="eyJjIjoibWFya2VkLWFzLXJlYWQ6NjQ0MDgxMSIsInQiOjE3MTM2OTY0MTZ9--64ac7f56c1316bedbb0f58791b679a31a33c5fe6fe01a76a172f10b5a958e7e4"
    data-channel-target="I_kwDOCNXcUc6GaFia"
    data-hpc
    >
      <div class="TimelineItem pt-0 js-comment-container js-socket-channel js-updatable-content  js-command-palette-issue-body"
  data-gid="I_kwDOCNXcUc6GaFia"
  data-url="/HiromiShikata/test-repository/issues/38/partials/body?issue=38"
  data-channel="eyJjIjoiaXNzdWU6MjI1NDk4NTM3MCIsInQiOjE3MTM2OTY0MTZ9--607be4872015f7956def485e4f24a9291857cbb6b2944964b7cdc4b0495a44e0">

  <div class="avatar-parent-child TimelineItem-avatar d-none d-md-block">
  <a class="d-inline-block" data-hovercard-type="user" data-hovercard-url="/users/HiromiShikata/hovercard" data-octo-click="hovercard-link-click" data-octo-dimensions="link_type:self" href="/HiromiShikata"><img class="avatar rounded-2 avatar-user" src="https://avatars.githubusercontent.com/u/6440811?s=80&amp;v=4" width="40" height="40" alt="@HiromiShikata" /></a>

</div>

  <div class="js-convert-task-to-issue-enabled convert-to-issue-enabled  timeline-comment-group js-minimizable-comment-group js-targetable-element TimelineItem-body my-0 " id="issue-2254985370">
    <div class="js-convert-task-to-issue-spinner loading-spinner ml-1 d-inline-block" hidden>
      <svg style="box-sizing: content-box; color: var(--color-icon-primary);" width="16" height="16" viewBox="0 0 16 16" fill="none" data-view-component="true" class="v-align-text-bottom anim-rotate">
  <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-opacity="0.25" stroke-width="2" vector-effect="non-scaling-stroke" fill="none" />
  <path d="M15 8a7.002 7.002 0 00-7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke" />
</svg>
    </div>
    <!-- '"\` --><!-- </textarea></xmp> --></option></form><form class="js-inline-convert-to-issue-form" data-turbo="false" action="/HiromiShikata/test-repository/issues" accept-charset="UTF-8" data-remote="true" method="post"><input type="hidden" name="authenticity_token" value="cOq0bzP8vw2896VeUNQ4h_rncxBCC4nCk45UuZ1iLBtoOOtwQLItp_2wKLQw0608L0dHwI9JcI51vTh9_rADLQ" />
      <input hidden id="js-inline-convert-to-issue-title" name="issue[title]" value="">
      <input hidden name="convert_from_task" value="true">
      <input hidden name="id" value="38">
      <input id="js-inline-convert-to-issue-position" type="hidden" name="position" value="">
</form>    <button class="js-convert-to-issue-button convert-to-issue-button btn-link d-block position-absolute tooltipped tooltipped-n tooltipped-no-delay" aria-label="Convert to issue" type="button" hidden>
      <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-issue-opened open v-align-top">
    <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"></path><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"></path>
</svg>
    </button>

      <button hidden="hidden" aria-label="Convert task list to block" type="button" data-view-component="true" class="js-convert-to-block-button convert-to-block-button btn-link show-on-focus tooltipped tooltipped-n tooltipped-no-delay btn d-block">    <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-checklist">
    <path d="M2.5 1.75v11.5c0 .138.112.25.25.25h3.17a.75.75 0 0 1 0 1.5H2.75A1.75 1.75 0 0 1 1 13.25V1.75C1 .784 1.784 0 2.75 0h8.5C12.216 0 13 .784 13 1.75v7.736a.75.75 0 0 1-1.5 0V1.75a.25.25 0 0 0-.25-.25h-8.5a.25.25 0 0 0-.25.25Zm13.274 9.537v-.001l-4.557 4.45a.75.75 0 0 1-1.055-.008l-1.943-1.95a.75.75 0 0 1 1.062-1.058l1.419 1.425 4.026-3.932a.75.75 0 1 1 1.048 1.074ZM4.75 4h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM4 7.75A.75.75 0 0 1 4.75 7h2a.75.75 0 0 1 0 1.5h-2A.75.75 0 0 1 4 7.75Z"></path>
</svg>
</button>
    <div class="js-convert-task-to-issue-data" data-tooltip-label-inline="Convert to issue" data-tooltip-label-open="Open convert to issue" data-tooltip-label-open-same-tab="Open convert to issue in current tab" data-url="/HiromiShikata/test-repository/issues/new" data-parent-issue-number="38" hidden></div>

    <div class="ml-n3 timeline-comment unminimized-comment comment previewable-edit js-task-list-container editable-comment js-comment timeline-comment--caret reorderable-task-lists current-user"
        data-body-version="23fe03b4fb4e7439d0966bd8b0b852ff1d144be1bf2f9e626c9d1124066b0d3c">
      <div class="timeline-comment-header clearfix d-flex"  data-morpheus-enabled="false">
  <div class="timeline-comment-actions flex-shrink-0 d-flex flex-items-center">
    <details class="details-overlay details-reset position-relative d-inline-block">
      <summary data-view-component="true" class="timeline-comment-action Link--secondary Button--link Button--medium Button">  <span class="Button-content">
    <span class="Button-label"><svg aria-label="Show options" role="img" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-kebab-horizontal">
    <path d="M8 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM1.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm13 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"></path>
</svg></span>
  </span>
</summary>

      <details-menu
        class="dropdown-menu dropdown-menu-sw show-more-popover color-fg-default"
        style="width:185px"
        src="/HiromiShikata/test-repository/issues/38/actions_menu?gid=I_kwDOCNXcUc6GaFia&amp;href=%23issue-2254985370"
        preload
        
      >
          <include-fragment class="js-comment-header-actions-deferred-include-fragment">
            <p class="text-center mt-3" data-hide-on-error>
              <svg aria-label="Loading..." style="box-sizing: content-box; color: var(--color-icon-primary);" width="32" height="32" viewBox="0 0 16 16" fill="none" data-view-component="true" class="anim-rotate">
  <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-opacity="0.25" stroke-width="2" vector-effect="non-scaling-stroke" fill="none" />
  <path d="M15 8a7.002 7.002 0 00-7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke" />
</svg>
            </p>
            <p class="ml-1 mb-2 mt-2" data-show-on-error hidden>
              <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-alert">
    <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"></path>
</svg>
              Sorry, something went wrong.
            </p>
            <button
              type="button"
              class="dropdown-item btn-link js-comment-quote-reply"
              hidden
              data-hotkey="r"
              role="menuitem"
            >
             Quote reply
            </button>
          </include-fragment>
      </details-menu>
    </details>
  </div>

  <div class="d-none d-sm-flex">
      

      

  <span aria-label="You are the owner of the test-repository repository." data-view-component="true" class="tooltipped tooltipped-n">
    <span data-view-component="true" class="Label ml-1">Owner</span>
</span>

      

  </div>

  <h3 class="f5 text-normal" style="flex: 1 1 auto">
    <div>
      

      <strong>
          <a class="author Link--primary text-bold css-overflow-wrap-anywhere " show_full_name="false" data-hovercard-type="user" data-hovercard-url="/users/HiromiShikata/hovercard" data-octo-click="hovercard-link-click" data-octo-dimensions="link_type:self" href="/HiromiShikata">HiromiShikata</a>
  

      </strong>

      

      commented


        <a href="#issue-2254985370" id="issue-2254985370-permalink" class="Link--secondary js-timestamp"><relative-time datetime="2024-04-21T09:26:54Z" class="no-wrap">Apr 21, 2024</relative-time></a>


      
    </div>

  </h3>
</div>


      <div class="edit-comment-hide">

        <task-lists disabled sortable>
<table class="d-block user-select-contain" data-paste-markdown-skip>
  <tbody class="d-block">
    <tr class="d-block">
      <td class="d-block comment-body markdown-body  js-comment-body">
          <p dir="auto">Test description</p>
<ul class="contains-task-list">
<li class="task-list-item"><input type="checkbox" id="" disabled="" class="task-list-item-checkbox"> checkbox 1</li>
<li>list item 1</li>
<li>list item 2</li>
</ul>
      </td>
    </tr>
      <tr class="d-block pl-3 pr-3 pb-3 js-comment-body-error" hidden>
        <td class="d-block">
          <div class="flash flash-warn" role="alert">
            <p class="mb-1">
              <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-info">
    <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path>
</svg>
              The text was updated successfully, but these errors were encountered:
            </p>
              <ol class="mb-0 pl-4 ml-4">
              </ol>
          </div>
        </td>
      </tr>
  </tbody>
</table>
</task-lists>


        <div class="d-flex">

            <div class="pr-review-reactions">
              <div data-view-component="true" class="comment-reactions just-bottom js-reactions-container js-reaction-buttons-container social-reactions reactions-container d-flex">
      <reactions-menu tabindex="-1">
    <details
      data-action="toggle:reactions-menu#focusFirstItem"
      data-target="reactions-menu.details"
      class="dropdown details-reset details-overlay d-inline-block new-reactions-dropdown js-reaction-popover-container js-comment-header-reaction-button">
        <summary data-target="reactions-menu.summary" aria-label="Add or remove reactions" aria-haspopup="true" data-view-component="true" class="circle reaction-dropdown-button reaction-dropdown-button--inline btn-invisible btn p-0 mr-1 d-flex flex-justify-center flex-items-center color-bg-subtle border color-border-muted">    <svg height="18" aria-hidden="true" viewBox="0 0 16 16" version="1.1" width="18" data-view-component="true" class="octicon octicon-smiley social-button-emoji">
    <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm3.82 1.636a.75.75 0 0 1 1.038.175l.007.009c.103.118.22.222.35.31.264.178.683.37 1.285.37.602 0 1.02-.192 1.285-.371.13-.088.247-.192.35-.31l.007-.008a.75.75 0 0 1 1.222.87l-.022-.015c.02.013.021.015.021.015v.001l-.001.002-.002.003-.005.007-.014.019a2.066 2.066 0 0 1-.184.213c-.16.166-.338.316-.53.445-.63.418-1.37.638-2.127.629-.946 0-1.652-.308-2.126-.63a3.331 3.331 0 0 1-.715-.657l-.014-.02-.005-.006-.002-.003v-.002h-.001l.613-.432-.614.43a.75.75 0 0 1 .183-1.044ZM12 7a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM5 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm5.25 2.25.592.416a97.71 97.71 0 0 0-.592-.416Z"></path>
</svg>
</summary>        <!-- '"\` --><!-- </textarea></xmp> --></option></form><form class="js-pick-reaction" data-turbo="false" action="/HiromiShikata/test-repository/reactions" accept-charset="UTF-8" method="post"><input type="hidden" name="_method" value="put" autocomplete="off" /><input type="hidden" name="authenticity_token" value="P0I6YolNbfcjJLW7J31uUgiQPzQHvBLliu2jWpd3RcnfZPvTFxPESgH4eBPUIHt6QEtkSR33vxtXkuj8Cgfykw" autocomplete="off" />
    <input type="hidden" name="input[subjectId]" value="I_kwDOCNXcUc6GaFia">
      <input type="hidden" name="input[context]" value="" >
    <ul class="dropdown-menu mt-2 d-flex mb-2 anim-scale-in dropdown-menu-reactions dropdown-menu-ne" role="menu">
        <li role="presentation">
            <button name="input[content]" id="reactions--reaction_button_component-3a704d" value="THUMBS_UP react" data-reaction-label="+1" data-reaction-content="+1" data-targets="reactions-menu.menuItems" role="menuitemcheckbox" aria-checked="false" aria-label="thumbs up" type="submit" data-view-component="true" class="dropdown-item dropdown-item-reaction btn-invisible btn d-flex no-underline color-fg-muted flex-justify-center flex-items-center rounded-2">    <g-emoji alias="+1" fallback-src="https://github.githubassets.com/assets/1f44d-41cb66fe1e22.png" class="d-flex">👍</g-emoji>
</button>        </li>
        <li role="presentation">
            <button name="input[content]" id="reactions--reaction_button_component-ea43c2" value="THUMBS_DOWN react" data-reaction-label="-1" data-reaction-content="-1" data-targets="reactions-menu.menuItems" role="menuitemcheckbox" aria-checked="false" aria-label="thumbs down" type="submit" data-view-component="true" class="dropdown-item dropdown-item-reaction btn-invisible btn d-flex no-underline color-fg-muted flex-justify-center flex-items-center rounded-2">    <g-emoji alias="-1" fallback-src="https://github.githubassets.com/assets/1f44e-ce91733aae25.png" class="d-flex">👎</g-emoji>
</button>        </li>
        <li role="presentation">
            <button name="input[content]" id="reactions--reaction_button_component-d67b38" value="LAUGH react" data-reaction-label="Laugh" data-reaction-content="smile" data-targets="reactions-menu.menuItems" role="menuitemcheckbox" aria-checked="false" aria-label="laugh" type="submit" data-view-component="true" class="dropdown-item dropdown-item-reaction btn-invisible btn d-flex no-underline color-fg-muted flex-justify-center flex-items-center rounded-2">    <g-emoji alias="smile" fallback-src="https://github.githubassets.com/assets/1f604-7528822fb4c5.png" class="d-flex">😄</g-emoji>
</button>        </li>
        <li role="presentation">
            <button name="input[content]" id="reactions--reaction_button_component-daf1c0" value="HOORAY react" data-reaction-label="Hooray" data-reaction-content="tada" data-targets="reactions-menu.menuItems" role="menuitemcheckbox" aria-checked="false" aria-label="hooray" type="submit" data-view-component="true" class="dropdown-item dropdown-item-reaction btn-invisible btn d-flex no-underline color-fg-muted flex-justify-center flex-items-center rounded-2">    <g-emoji alias="tada" fallback-src="https://github.githubassets.com/assets/1f389-36899a2cb781.png" class="d-flex">🎉</g-emoji>
</button>        </li>
        <li role="presentation">
            <button name="input[content]" id="reactions--reaction_button_component-a81e2c" value="CONFUSED react" data-reaction-label="Confused" data-reaction-content="thinking_face" data-targets="reactions-menu.menuItems" role="menuitemcheckbox" aria-checked="false" aria-label="confused" type="submit" data-view-component="true" class="dropdown-item dropdown-item-reaction btn-invisible btn d-flex no-underline color-fg-muted flex-justify-center flex-items-center rounded-2">    <g-emoji alias="thinking_face" fallback-src="https://github.githubassets.com/assets/1f615-4bb1369c4251.png" class="d-flex">😕</g-emoji>
</button>        </li>
        <li role="presentation">
            <button name="input[content]" id="reactions--reaction_button_component-7cdcb5" value="HEART react" data-reaction-label="Heart" data-reaction-content="heart" data-targets="reactions-menu.menuItems" role="menuitemcheckbox" aria-checked="false" aria-label="heart" type="submit" data-view-component="true" class="dropdown-item dropdown-item-reaction btn-invisible btn d-flex no-underline color-fg-muted flex-justify-center flex-items-center rounded-2">    <g-emoji alias="heart" fallback-src="https://github.githubassets.com/assets/2764-982dc91ea48a.png" class="d-flex">❤️</g-emoji>
</button>        </li>
        <li role="presentation">
            <button name="input[content]" id="reactions--reaction_button_component-c57110" value="ROCKET react" data-reaction-label="Rocket" data-reaction-content="rocket" data-targets="reactions-menu.menuItems" role="menuitemcheckbox" aria-checked="false" aria-label="rocket" type="submit" data-view-component="true" class="dropdown-item dropdown-item-reaction btn-invisible btn d-flex no-underline color-fg-muted flex-justify-center flex-items-center rounded-2">    <g-emoji alias="rocket" fallback-src="https://github.githubassets.com/assets/1f680-d0ef47fdb515.png" class="d-flex">🚀</g-emoji>
</button>        </li>
        <li role="presentation">
            <button name="input[content]" id="reactions--reaction_button_component-ae981f" value="EYES react" data-reaction-label="Eyes" data-reaction-content="eyes" data-targets="reactions-menu.menuItems" role="menuitemcheckbox" aria-checked="false" aria-label="eyes" type="submit" data-view-component="true" class="dropdown-item dropdown-item-reaction btn-invisible btn d-flex no-underline color-fg-muted flex-justify-center flex-items-center rounded-2">    <g-emoji alias="eyes" fallback-src="https://github.githubassets.com/assets/1f440-ee44e91e92a7.png" class="d-flex">👀</g-emoji>
</button>        </li>
    </ul>
</form>
    </details>
  </reactions-menu>

  <!-- '"\` --><!-- </textarea></xmp> --></option></form><form class="js-pick-reaction" data-turbo="false" action="/HiromiShikata/test-repository/reactions" accept-charset="UTF-8" method="post"><input type="hidden" name="_method" value="put" autocomplete="off" /><input type="hidden" name="authenticity_token" value="16WWJrYgJAaVEV5PN1-YGptaYLG1mudvUhycNczoONk3g1eXKH6Nu7fNk-fEAo0y04E7zK_RSpGPY9eTUZiPgw" autocomplete="off" />
    <input type="hidden" name="input[subjectId]" value="I_kwDOCNXcUc6GaFia">
      <input type="hidden" name="input[context]" value="" >
    <div  class="js-comment-reactions-options d-flex flex-items-center flex-row flex-wrap">
      <div class="js-reactions-container">
        <details class="dropdown details-reset details-overlay d-inline-block js-all-reactions-popover" hidden>
          <summary aria-haspopup="true" data-view-component="true" class="Button--link Button--medium Button">  <span class="Button-content">
    <span class="Button-label">All reactions</span>
  </span>
</summary>

          <ul class="dropdown-menu dropdown-menu-se">
          </ul>
        </details>
      </div>
    </div>
</form></div>
            </div>
        </div>
      </div>

      <!-- '"\` --><!-- </textarea></xmp> --></option></form><form class="js-comment-update" id="issue-2254985370-edit-form" data-turbo="false" action="/HiromiShikata/test-repository/issues/38" accept-charset="UTF-8" method="post"><input type="hidden" name="_method" value="put" autocomplete="off" /><input type="hidden" name="authenticity_token" value="SNk9rjlzH5iHsfdhc5Jea7ueCA5gb515byzgm3JDQLK76-FmkWKv3pJUOyh8Paprb0MaB5VNb-JwNAvQVrf3og" />
              <div class="js-previewable-comment-form previewable-comment-form write-selected"
      data-preview-url="/preview?issue=2254985370&amp;markdown_unsupported=false&amp;repository=148233297&amp;subject_type=Issue"
      >
  <div class="Box CommentBox m-2">
    <input type="hidden" value="SYogTaUngjh3A8-F8KB_qNYagraijaEzE1vwgq6FVokRqFbuClsS4kMtK-jwcFIKjUoDatGvjnTLq_2oVqSUng" data-csrf="true" class="js-data-preview-url-csrf" />
    
<div class="tabnav CommentBox-header p-0 position-static">
  <div class="tabnav-tabs" role="tablist" aria-label="Preview">
    <button type="button" class="btn-link tabnav-tab write-tab js-write-tab selected" role="tab" aria-selected="true">Write</button>
    <button type="button" class="btn-link tabnav-tab preview-tab js-preview-tab" role="tab">Preview</button>
  </div>

    <markdown-toolbar role="presentation" for="issue-2254985370-body" data-no-focus="true" data-view-component="true" class="CommentBox-toolbar">
  <action-bar role="toolbar" data-view-component="true" class="ActionBar">
  <div data-target="action-bar.itemContainer" data-view-component="true" class="ActionBar-item-container">
      <div data-targets="action-bar.items" data-view-component="true" class="ActionBar-item"><button id="action-bar-1089d6d1-34a8-4fc1-8c72-bea5a031da9d" data-md-button="header-3" data-analytics-event="{&quot;category&quot;:&quot;comment_box&quot;,&quot;action&quot;:&quot;HEADING&quot;,&quot;label&quot;:null}" aria-labelledby="tooltip-bd14acab-292d-4c9c-b61b-3750e9215b0e" type="button" data-view-component="true" class="Button Button--iconOnly Button--invisible Button--medium">  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-heading Button-visual">
    <path d="M3.75 2a.75.75 0 0 1 .75.75V7h7V2.75a.75.75 0 0 1 1.5 0v10.5a.75.75 0 0 1-1.5 0V8.5h-7v4.75a.75.75 0 0 1-1.5 0V2.75A.75.75 0 0 1 3.75 2Z"></path>
</svg>
</button><tool-tip id="tooltip-bd14acab-292d-4c9c-b61b-3750e9215b0e" for="action-bar-1089d6d1-34a8-4fc1-8c72-bea5a031da9d" popover="manual" data-direction="s" data-type="label" data-view-component="true" class="sr-only position-absolute">Heading</tool-tip>
</div>
      <div data-targets="action-bar.items" data-view-component="true" class="ActionBar-item"><button id="action-bar-2b8ffbab-ae9e-4376-8018-1b1ea8c70967" data-md-button="bold" data-hotkey-scope="issue-2254985370-body" data-hotkey="Control+b" data-analytics-event="{&quot;category&quot;:&quot;comment_box&quot;,&quot;action&quot;:&quot;BOLD&quot;,&quot;label&quot;:null}" aria-labelledby="tooltip-66aa88e2-ac00-4ff0-ab21-4b77263c2f43" type="button" data-view-component="true" class="Button Button--iconOnly Button--invisible Button--medium">  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-bold Button-visual">
    <path d="M4 2h4.5a3.501 3.501 0 0 1 2.852 5.53A3.499 3.499 0 0 1 9.5 14H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm1 7v3h4.5a1.5 1.5 0 0 0 0-3Zm3.5-2a1.5 1.5 0 0 0 0-3H5v3Z"></path>
</svg>
</button><tool-tip id="tooltip-66aa88e2-ac00-4ff0-ab21-4b77263c2f43" for="action-bar-2b8ffbab-ae9e-4376-8018-1b1ea8c70967" popover="manual" data-direction="s" data-type="label" data-view-component="true" class="sr-only position-absolute">Bold</tool-tip>
</div>
      <div data-targets="action-bar.items" data-view-component="true" class="ActionBar-item"><button id="action-bar-156ff942-9929-4451-80a5-e6f20dd11f9b" data-md-button="italic" data-hotkey-scope="issue-2254985370-body" data-hotkey="Control+i" data-analytics-event="{&quot;category&quot;:&quot;comment_box&quot;,&quot;action&quot;:&quot;ITALIC&quot;,&quot;label&quot;:null}" aria-labelledby="tooltip-261c28e4-413e-4dbf-a773-bc1517247ff0" type="button" data-view-component="true" class="Button Button--iconOnly Button--invisible Button--medium">  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-italic Button-visual">
    <path d="M6 2.75A.75.75 0 0 1 6.75 2h6.5a.75.75 0 0 1 0 1.5h-2.505l-3.858 9H9.25a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1 0-1.5h2.505l3.858-9H6.75A.75.75 0 0 1 6 2.75Z"></path>
</svg>
</button><tool-tip id="tooltip-261c28e4-413e-4dbf-a773-bc1517247ff0" for="action-bar-156ff942-9929-4451-80a5-e6f20dd11f9b" popover="manual" data-direction="s" data-type="label" data-view-component="true" class="sr-only position-absolute">Italic</tool-tip>
</div>
      <div data-targets="action-bar.items" data-view-component="true" class="ActionBar-item"><button id="action-bar-d25c8fe8-822d-4305-a5eb-1178cccb91f3" data-md-button="quote" data-hotkey-scope="issue-2254985370-body" data-hotkey="Control+Shift+&gt;" data-analytics-event="{&quot;category&quot;:&quot;comment_box&quot;,&quot;action&quot;:&quot;QUOTE&quot;,&quot;label&quot;:null}" aria-labelledby="tooltip-3173290d-23d5-4a4b-ad00-95a6005e4a6c" type="button" data-view-component="true" class="Button Button--iconOnly Button--invisible Button--medium">  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-quote Button-visual">
    <path d="M1.75 2.5h10.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1 0-1.5Zm4 5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5Zm0 5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5ZM2.5 7.75v6a.75.75 0 0 1-1.5 0v-6a.75.75 0 0 1 1.5 0Z"></path>
</svg>
</button><tool-tip id="tooltip-3173290d-23d5-4a4b-ad00-95a6005e4a6c" for="action-bar-d25c8fe8-822d-4305-a5eb-1178cccb91f3" popover="manual" data-direction="s" data-type="label" data-view-component="true" class="sr-only position-absolute">Quote</tool-tip>
</div>
      <div data-targets="action-bar.items" data-view-component="true" class="ActionBar-item"><button id="action-bar-3d43da80-69f8-4ebe-9c21-de7df80dc5ac" data-md-button="code" data-hotkey-scope="issue-2254985370-body" data-hotkey="Control+e" data-analytics-event="{&quot;category&quot;:&quot;comment_box&quot;,&quot;action&quot;:&quot;CODE&quot;,&quot;label&quot;:null}" aria-labelledby="tooltip-7286c364-d2c7-4674-943f-b2682161b12f" type="button" data-view-component="true" class="Button Button--iconOnly Button--invisible Button--medium">  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-code Button-visual">
    <path d="m11.28 3.22 4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L13.94 8l-3.72-3.72a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215Zm-6.56 0a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L2.06 8l3.72 3.72a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L.47 8.53a.75.75 0 0 1 0-1.06Z"></path>
</svg>
</button><tool-tip id="tooltip-7286c364-d2c7-4674-943f-b2682161b12f" for="action-bar-3d43da80-69f8-4ebe-9c21-de7df80dc5ac" popover="manual" data-direction="s" data-type="label" data-view-component="true" class="sr-only position-absolute">Code</tool-tip>
</div>
      <div data-targets="action-bar.items" data-view-component="true" class="ActionBar-item"><button id="action-bar-3af7f92b-852b-426b-940b-e02900790c32" data-md-button="link" data-hotkey-scope="issue-2254985370-body" data-hotkey="Control+k" data-analytics-event="{&quot;category&quot;:&quot;comment_box&quot;,&quot;action&quot;:&quot;LINK&quot;,&quot;label&quot;:null}" aria-labelledby="tooltip-f78cb089-4e00-41ad-95fe-5c5b1e4e7eef" type="button" data-view-component="true" class="Button Button--iconOnly Button--invisible Button--medium">  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-link Button-visual">
    <path d="m7.775 3.275 1.25-1.25a3.5 3.5 0 1 1 4.95 4.95l-2.5 2.5a3.5 3.5 0 0 1-4.95 0 .751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018 1.998 1.998 0 0 0 2.83 0l2.5-2.5a2.002 2.002 0 0 0-2.83-2.83l-1.25 1.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042Zm-4.69 9.64a1.998 1.998 0 0 0 2.83 0l1.25-1.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-1.25 1.25a3.5 3.5 0 1 1-4.95-4.95l2.5-2.5a3.5 3.5 0 0 1 4.95 0 .751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018 1.998 1.998 0 0 0-2.83 0l-2.5 2.5a1.998 1.998 0 0 0 0 2.83Z"></path>
</svg>
</button><tool-tip id="tooltip-f78cb089-4e00-41ad-95fe-5c5b1e4e7eef" for="action-bar-3af7f92b-852b-426b-940b-e02900790c32" popover="manual" data-direction="s" data-type="label" data-view-component="true" class="sr-only position-absolute">Link</tool-tip>
</div>
      <hr role="presentation" aria-hidden="true" data-targets="action-bar.items" data-view-component="true" class="ActionBar-item ActionBar-divider" />
      <div data-targets="action-bar.items" data-view-component="true" class="ActionBar-item"><button id="action-bar-a9bfb97a-fb2a-4012-8564-8f14ed53e7db" data-md-button="ordered-list" data-hotkey-scope="issue-2254985370-body" data-hotkey="Control+Shift+&amp;" data-analytics-event="{&quot;category&quot;:&quot;comment_box&quot;,&quot;action&quot;:&quot;ORDERED_LIST&quot;,&quot;label&quot;:null}" aria-labelledby="tooltip-373fd6d4-6d6a-4def-8b1e-4fc7efbc8261" type="button" data-view-component="true" class="Button Button--iconOnly Button--invisible Button--medium">  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-list-ordered Button-visual">
    <path d="M5 3.25a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 5 3.25Zm0 5a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 5 8.25Zm0 5a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1-.75-.75ZM.924 10.32a.5.5 0 0 1-.851-.525l.001-.001.001-.002.002-.004.007-.011c.097-.144.215-.273.348-.384.228-.19.588-.392 1.068-.392.468 0 .858.181 1.126.484.259.294.377.673.377 1.038 0 .987-.686 1.495-1.156 1.845l-.047.035c-.303.225-.522.4-.654.597h1.357a.5.5 0 0 1 0 1H.5a.5.5 0 0 1-.5-.5c0-1.005.692-1.52 1.167-1.875l.035-.025c.531-.396.8-.625.8-1.078a.57.57 0 0 0-.128-.376C1.806 10.068 1.695 10 1.5 10a.658.658 0 0 0-.429.163.835.835 0 0 0-.144.153ZM2.003 2.5V6h.503a.5.5 0 0 1 0 1H.5a.5.5 0 0 1 0-1h.503V3.308l-.28.14a.5.5 0 0 1-.446-.895l1.003-.5a.5.5 0 0 1 .723.447Z"></path>
</svg>
</button><tool-tip id="tooltip-373fd6d4-6d6a-4def-8b1e-4fc7efbc8261" for="action-bar-a9bfb97a-fb2a-4012-8564-8f14ed53e7db" popover="manual" data-direction="s" data-type="label" data-view-component="true" class="sr-only position-absolute">Numbered list</tool-tip>
</div>
      <div data-targets="action-bar.items" data-view-component="true" class="ActionBar-item"><button id="action-bar-a6786a74-7b82-4f56-9f0c-034c4397f0ed" data-md-button="unordered-list" data-hotkey-scope="issue-2254985370-body" data-hotkey="Control+Shift+*" data-analytics-event="{&quot;category&quot;:&quot;comment_box&quot;,&quot;action&quot;:&quot;UNORDERED_LIST&quot;,&quot;label&quot;:null}" aria-labelledby="tooltip-1b46eec1-8cd2-498d-8a85-e344cc7e1650" type="button" data-view-component="true" class="Button Button--iconOnly Button--invisible Button--medium">  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-list-unordered Button-visual">
    <path d="M5.75 2.5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5Zm0 5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5Zm0 5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5ZM2 14a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm1-6a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM2 4a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path>
</svg>
</button><tool-tip id="tooltip-1b46eec1-8cd2-498d-8a85-e344cc7e1650" for="action-bar-a6786a74-7b82-4f56-9f0c-034c4397f0ed" popover="manual" data-direction="s" data-type="label" data-view-component="true" class="sr-only position-absolute">Unordered list</tool-tip>
</div>
      <div data-targets="action-bar.items" data-view-component="true" class="ActionBar-item"><button id="action-bar-2871be11-f2b3-477a-b04d-0aa34f5a59e4" data-md-button="task-list" data-hotkey-scope="issue-2254985370-body" data-hotkey="Control+Shift+L" data-analytics-event="{&quot;category&quot;:&quot;comment_box&quot;,&quot;action&quot;:&quot;TASK_LIST&quot;,&quot;label&quot;:null}" aria-labelledby="tooltip-d6f7442e-ea3c-49c5-89b3-0582ecae5cab" type="button" data-view-component="true" class="Button Button--iconOnly Button--invisible Button--medium">  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-tasklist Button-visual">
    <path d="M2 2h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm4.655 8.595a.75.75 0 0 1 0 1.06L4.03 14.28a.75.75 0 0 1-1.06 0l-1.5-1.5a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215l.97.97 2.095-2.095a.75.75 0 0 1 1.06 0ZM9.75 2.5h5.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1 0-1.5Zm0 5h5.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1 0-1.5Zm0 5h5.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1 0-1.5Zm-7.25-9v3h3v-3Z"></path>
</svg>
</button><tool-tip id="tooltip-d6f7442e-ea3c-49c5-89b3-0582ecae5cab" for="action-bar-2871be11-f2b3-477a-b04d-0aa34f5a59e4" popover="manual" data-direction="s" data-type="label" data-view-component="true" class="sr-only position-absolute">Task list</tool-tip>
</div>
      <hr role="presentation" aria-hidden="true" data-targets="action-bar.items" data-view-component="true" class="ActionBar-item ActionBar-divider" />
      <div data-targets="action-bar.items" data-view-component="true" class="ActionBar-item"><button id="action-bar-4cf67b7a-5a46-4dc7-83ea-a4b218a204c7" data-analytics-event="{&quot;category&quot;:&quot;comment_box&quot;,&quot;action&quot;:&quot;ATTACH_FILES&quot;,&quot;label&quot;:null}" data-file-attachment-for="fc-issue-2254985370-body" aria-labelledby="tooltip-c0751bfa-1739-440a-a2c1-f95d0942cf3f" type="button" data-view-component="true" class="Button Button--iconOnly Button--invisible Button--medium">  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-paperclip Button-visual">
    <path d="M12.212 3.02a1.753 1.753 0 0 0-2.478.003l-5.83 5.83a3.007 3.007 0 0 0-.88 2.127c0 .795.315 1.551.88 2.116.567.567 1.333.89 2.126.89.79 0 1.548-.321 2.116-.89l5.48-5.48a.75.75 0 0 1 1.061 1.06l-5.48 5.48a4.492 4.492 0 0 1-3.177 1.33c-1.2 0-2.345-.487-3.187-1.33a4.483 4.483 0 0 1-1.32-3.177c0-1.195.475-2.341 1.32-3.186l5.83-5.83a3.25 3.25 0 0 1 5.553 2.297c0 .863-.343 1.691-.953 2.301L7.439 12.39c-.375.377-.884.59-1.416.593a1.998 1.998 0 0 1-1.412-.593 1.992 1.992 0 0 1 0-2.828l5.48-5.48a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-5.48 5.48a.492.492 0 0 0 0 .707.499.499 0 0 0 .352.154.51.51 0 0 0 .356-.154l5.833-5.827a1.755 1.755 0 0 0 0-2.481Z"></path>
</svg>
</button><tool-tip id="tooltip-c0751bfa-1739-440a-a2c1-f95d0942cf3f" for="action-bar-4cf67b7a-5a46-4dc7-83ea-a4b218a204c7" popover="manual" data-direction="s" data-type="label" data-view-component="true" class="sr-only position-absolute">Attach files</tool-tip>
</div>
      <div data-targets="action-bar.items" data-view-component="true" class="ActionBar-item"><button id="action-bar-fcb290d1-c2b3-402f-9b25-039224df2c63" data-md-button="mention" data-analytics-event="{&quot;category&quot;:&quot;comment_box&quot;,&quot;action&quot;:&quot;MENTION&quot;,&quot;label&quot;:null}" aria-labelledby="tooltip-34b5e9db-b77b-4641-9639-f8f0747d1d18" type="button" data-view-component="true" class="Button Button--iconOnly Button--invisible Button--medium">  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-mention Button-visual">
    <path d="M4.75 2.37a6.501 6.501 0 0 0 6.5 11.26.75.75 0 0 1 .75 1.298A7.999 7.999 0 0 1 .989 4.148 8 8 0 0 1 16 7.75v1.5a2.75 2.75 0 0 1-5.072 1.475 3.999 3.999 0 0 1-6.65-4.19A4 4 0 0 1 12 8v1.25a1.25 1.25 0 0 0 2.5 0V7.867a6.5 6.5 0 0 0-9.75-5.496ZM10.5 8a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"></path>
</svg>
</button><tool-tip id="tooltip-34b5e9db-b77b-4641-9639-f8f0747d1d18" for="action-bar-fcb290d1-c2b3-402f-9b25-039224df2c63" popover="manual" data-direction="s" data-type="label" data-view-component="true" class="sr-only position-absolute">Mention</tool-tip>
</div>
      <div data-targets="action-bar.items" data-view-component="true" class="ActionBar-item"><button id="action-bar-b049945c-ff6b-48c0-9b85-55b15a24e508" data-md-button="ref" data-analytics-event="{&quot;category&quot;:&quot;comment_box&quot;,&quot;action&quot;:&quot;REFERENCE&quot;,&quot;label&quot;:null}" aria-labelledby="tooltip-d16fb770-df16-45ff-ab34-219c9d9c8c2a" type="button" data-view-component="true" class="Button Button--iconOnly Button--invisible Button--medium">  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-cross-reference Button-visual">
    <path d="M2.75 3.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h4.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 13H9.06l-2.573 2.573A1.458 1.458 0 0 1 4 14.543V13H2.75A1.75 1.75 0 0 1 1 11.25v-7.5C1 2.784 1.784 2 2.75 2h5.5a.75.75 0 0 1 0 1.5ZM16 1.25v4.146a.25.25 0 0 1-.427.177L14.03 4.03l-3.75 3.75a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l3.75-3.75-1.543-1.543A.25.25 0 0 1 11.604 1h4.146a.25.25 0 0 1 .25.25Z"></path>
</svg>
</button><tool-tip id="tooltip-d16fb770-df16-45ff-ab34-219c9d9c8c2a" for="action-bar-b049945c-ff6b-48c0-9b85-55b15a24e508" popover="manual" data-direction="s" data-type="label" data-view-component="true" class="sr-only position-absolute">Reference</tool-tip>
</div>
      <div data-targets="action-bar.items" data-view-component="true" class="ActionBar-item"><button id="action-bar-b32a4083-6a95-481e-b16c-d8786f0c67b8" data-show-dialog-id="saved_replies_menu_issue-2254985370-body-dialog" data-analytics-event="{&quot;category&quot;:&quot;comment_box&quot;,&quot;action&quot;:&quot;SAVED_REPLIES&quot;,&quot;label&quot;:null}" aria-labelledby="tooltip-5dd25405-3b27-4ef0-8765-f2b4477e4233" type="button" data-view-component="true" class="Button Button--iconOnly Button--invisible Button--medium">  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-reply Button-visual">
    <path d="M6.78 1.97a.75.75 0 0 1 0 1.06L3.81 6h6.44A4.75 4.75 0 0 1 15 10.75v2.5a.75.75 0 0 1-1.5 0v-2.5a3.25 3.25 0 0 0-3.25-3.25H3.81l2.97 2.97a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L1.47 7.28a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"></path>
</svg>
</button><tool-tip id="tooltip-5dd25405-3b27-4ef0-8765-f2b4477e4233" for="action-bar-b32a4083-6a95-481e-b16c-d8786f0c67b8" popover="manual" data-direction="s" data-type="label" data-view-component="true" class="sr-only position-absolute">Saved replies</tool-tip>
</div>
      <slash-command-toolbar-button data-targets="action-bar.items" data-view-component="true" class="ActionBar-item"><button id="action-bar-73b08e41-d6be-4d65-a587-1e4e7ee7718b" data-action="click:slash-command-toolbar-button#triggerMenu" data-analytics-event="{&quot;category&quot;:&quot;comment_box&quot;,&quot;action&quot;:&quot;SLASH_COMMANDS&quot;,&quot;label&quot;:null}" aria-labelledby="tooltip-9ef727bb-b308-4fde-87e0-af15dc03e4c2" type="button" data-view-component="true" class="Button Button--iconOnly Button--invisible Button--medium">  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-diff-ignored Button-visual">
    <path d="M13.25 1c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 13.25 15H2.75A1.75 1.75 0 0 1 1 13.25V2.75C1 1.784 1.784 1 2.75 1ZM2.75 2.5a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25V2.75a.25.25 0 0 0-.25-.25Zm8.53 3.28-5.5 5.5a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l5.5-5.5a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z"></path>
</svg>
</button><tool-tip id="tooltip-9ef727bb-b308-4fde-87e0-af15dc03e4c2" for="action-bar-73b08e41-d6be-4d65-a587-1e4e7ee7718b" popover="manual" data-direction="s" data-type="label" data-view-component="true" class="sr-only position-absolute">Slash commands</tool-tip>
</slash-command-toolbar-button>
</div>    <action-menu data-target="action-bar.moreMenu" hidden="hidden" data-select-variant="none" data-view-component="true" class="ActionBar-more-menu">
  <focus-group direction="vertical" mnemonics retain>
    <button id="action-bar-a0a898b7-2976-4633-ae73-dfa8b3eaf290-button" popovertarget="action-bar-a0a898b7-2976-4633-ae73-dfa8b3eaf290-overlay" aria-controls="action-bar-a0a898b7-2976-4633-ae73-dfa8b3eaf290-list" aria-haspopup="true" aria-labelledby="tooltip-1977939f-3636-4449-afaf-0b6ef7734205" type="button" data-view-component="true" class="Button Button--iconOnly Button--invisible Button--medium">  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-kebab-horizontal Button-visual">
    <path d="M8 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM1.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm13 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"></path>
</svg>
</button><tool-tip id="tooltip-1977939f-3636-4449-afaf-0b6ef7734205" for="action-bar-a0a898b7-2976-4633-ae73-dfa8b3eaf290-button" popover="manual" data-direction="s" data-type="label" data-view-component="true" class="sr-only position-absolute">Menu</tool-tip>


<anchored-position id="action-bar-a0a898b7-2976-4633-ae73-dfa8b3eaf290-overlay" anchor="action-bar-a0a898b7-2976-4633-ae73-dfa8b3eaf290-button" align="end" side="outside-bottom" anchor-offset="normal" popover="auto" data-view-component="true">
  <div data-view-component="true" class="Overlay Overlay--size-auto">
    
      <div data-view-component="true" class="Overlay-body Overlay-body--paddingNone">          <action-list>
  <div data-view-component="true">
    <ul aria-labelledby="action-bar-a0a898b7-2976-4633-ae73-dfa8b3eaf290-button" id="action-bar-a0a898b7-2976-4633-ae73-dfa8b3eaf290-list" role="menu" data-view-component="true" class="ActionListWrap--inset ActionListWrap">
        <li value="" hidden="hidden" data-for="action-bar-1089d6d1-34a8-4fc1-8c72-bea5a031da9d" data-action="click:action-bar#menuItemClick" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <button tabindex="-1" id="item-368e036f-4b9c-4d99-a469-276c691f8283" type="button" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-heading">
    <path d="M3.75 2a.75.75 0 0 1 .75.75V7h7V2.75a.75.75 0 0 1 1.5 0v10.5a.75.75 0 0 1-1.5 0V8.5h-7v4.75a.75.75 0 0 1-1.5 0V2.75A.75.75 0 0 1 3.75 2Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Heading
</span></button>
  
  
</li>
        <li value="" hidden="hidden" data-for="action-bar-2b8ffbab-ae9e-4376-8018-1b1ea8c70967" data-action="click:action-bar#menuItemClick" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <button tabindex="-1" id="item-4ba0a46e-664a-47c6-8794-bbf0ef3b9681" type="button" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-bold">
    <path d="M4 2h4.5a3.501 3.501 0 0 1 2.852 5.53A3.499 3.499 0 0 1 9.5 14H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm1 7v3h4.5a1.5 1.5 0 0 0 0-3Zm3.5-2a1.5 1.5 0 0 0 0-3H5v3Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Bold
</span></button>
  
  
</li>
        <li value="" hidden="hidden" data-for="action-bar-156ff942-9929-4451-80a5-e6f20dd11f9b" data-action="click:action-bar#menuItemClick" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <button tabindex="-1" id="item-c90858fa-4c74-4421-9d00-03498a1d9ae8" type="button" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-italic">
    <path d="M6 2.75A.75.75 0 0 1 6.75 2h6.5a.75.75 0 0 1 0 1.5h-2.505l-3.858 9H9.25a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1 0-1.5h2.505l3.858-9H6.75A.75.75 0 0 1 6 2.75Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Italic
</span></button>
  
  
</li>
        <li value="" hidden="hidden" data-for="action-bar-d25c8fe8-822d-4305-a5eb-1178cccb91f3" data-action="click:action-bar#menuItemClick" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <button tabindex="-1" id="item-3ee4eae8-5625-4dd1-bd25-462e6609c08f" type="button" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-quote">
    <path d="M1.75 2.5h10.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1 0-1.5Zm4 5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5Zm0 5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5ZM2.5 7.75v6a.75.75 0 0 1-1.5 0v-6a.75.75 0 0 1 1.5 0Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Quote
</span></button>
  
  
</li>
        <li value="" hidden="hidden" data-for="action-bar-3d43da80-69f8-4ebe-9c21-de7df80dc5ac" data-action="click:action-bar#menuItemClick" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <button tabindex="-1" id="item-d9d8535c-cb9d-4f24-864f-ce7d7062ce02" type="button" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-code">
    <path d="m11.28 3.22 4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L13.94 8l-3.72-3.72a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215Zm-6.56 0a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L2.06 8l3.72 3.72a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L.47 8.53a.75.75 0 0 1 0-1.06Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Code
</span></button>
  
  
</li>
        <li value="" hidden="hidden" data-for="action-bar-3af7f92b-852b-426b-940b-e02900790c32" data-action="click:action-bar#menuItemClick" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <button tabindex="-1" id="item-21dbe746-4453-4960-81a5-1458762aa014" type="button" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-link">
    <path d="m7.775 3.275 1.25-1.25a3.5 3.5 0 1 1 4.95 4.95l-2.5 2.5a3.5 3.5 0 0 1-4.95 0 .751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018 1.998 1.998 0 0 0 2.83 0l2.5-2.5a2.002 2.002 0 0 0-2.83-2.83l-1.25 1.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042Zm-4.69 9.64a1.998 1.998 0 0 0 2.83 0l1.25-1.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-1.25 1.25a3.5 3.5 0 1 1-4.95-4.95l2.5-2.5a3.5 3.5 0 0 1 4.95 0 .751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018 1.998 1.998 0 0 0-2.83 0l-2.5 2.5a1.998 1.998 0 0 0 0 2.83Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Link
</span></button>
  
  
</li>
        <li hidden="hidden" role="presentation" aria-hidden="true" data-view-component="true" class="ActionList-sectionDivider"></li>
        <li value="" hidden="hidden" data-for="action-bar-a9bfb97a-fb2a-4012-8564-8f14ed53e7db" data-action="click:action-bar#menuItemClick" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <button tabindex="-1" id="item-1c8efcc2-e769-4341-9a7a-6888a1f4c2a1" type="button" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-list-ordered">
    <path d="M5 3.25a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 5 3.25Zm0 5a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 5 8.25Zm0 5a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1-.75-.75ZM.924 10.32a.5.5 0 0 1-.851-.525l.001-.001.001-.002.002-.004.007-.011c.097-.144.215-.273.348-.384.228-.19.588-.392 1.068-.392.468 0 .858.181 1.126.484.259.294.377.673.377 1.038 0 .987-.686 1.495-1.156 1.845l-.047.035c-.303.225-.522.4-.654.597h1.357a.5.5 0 0 1 0 1H.5a.5.5 0 0 1-.5-.5c0-1.005.692-1.52 1.167-1.875l.035-.025c.531-.396.8-.625.8-1.078a.57.57 0 0 0-.128-.376C1.806 10.068 1.695 10 1.5 10a.658.658 0 0 0-.429.163.835.835 0 0 0-.144.153ZM2.003 2.5V6h.503a.5.5 0 0 1 0 1H.5a.5.5 0 0 1 0-1h.503V3.308l-.28.14a.5.5 0 0 1-.446-.895l1.003-.5a.5.5 0 0 1 .723.447Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Numbered list
</span></button>
  
  
</li>
        <li value="" hidden="hidden" data-for="action-bar-a6786a74-7b82-4f56-9f0c-034c4397f0ed" data-action="click:action-bar#menuItemClick" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <button tabindex="-1" id="item-e446f3d4-2180-4ddd-b5ea-1082f693c9ee" type="button" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-list-unordered">
    <path d="M5.75 2.5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5Zm0 5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5Zm0 5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5ZM2 14a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm1-6a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM2 4a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Unordered list
</span></button>
  
  
</li>
        <li value="" hidden="hidden" data-for="action-bar-2871be11-f2b3-477a-b04d-0aa34f5a59e4" data-action="click:action-bar#menuItemClick" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <button tabindex="-1" id="item-110ab925-a265-4a96-a306-93df6916eab0" type="button" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-tasklist">
    <path d="M2 2h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm4.655 8.595a.75.75 0 0 1 0 1.06L4.03 14.28a.75.75 0 0 1-1.06 0l-1.5-1.5a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215l.97.97 2.095-2.095a.75.75 0 0 1 1.06 0ZM9.75 2.5h5.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1 0-1.5Zm0 5h5.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1 0-1.5Zm0 5h5.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1 0-1.5Zm-7.25-9v3h3v-3Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Task list
</span></button>
  
  
</li>
        <li hidden="hidden" role="presentation" aria-hidden="true" data-view-component="true" class="ActionList-sectionDivider"></li>
        <li value="" hidden="hidden" data-for="action-bar-4cf67b7a-5a46-4dc7-83ea-a4b218a204c7" data-action="click:action-bar#menuItemClick" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <button tabindex="-1" id="item-1399eb11-d7ae-4e0b-9baf-2a75a479687d" type="button" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-paperclip">
    <path d="M12.212 3.02a1.753 1.753 0 0 0-2.478.003l-5.83 5.83a3.007 3.007 0 0 0-.88 2.127c0 .795.315 1.551.88 2.116.567.567 1.333.89 2.126.89.79 0 1.548-.321 2.116-.89l5.48-5.48a.75.75 0 0 1 1.061 1.06l-5.48 5.48a4.492 4.492 0 0 1-3.177 1.33c-1.2 0-2.345-.487-3.187-1.33a4.483 4.483 0 0 1-1.32-3.177c0-1.195.475-2.341 1.32-3.186l5.83-5.83a3.25 3.25 0 0 1 5.553 2.297c0 .863-.343 1.691-.953 2.301L7.439 12.39c-.375.377-.884.59-1.416.593a1.998 1.998 0 0 1-1.412-.593 1.992 1.992 0 0 1 0-2.828l5.48-5.48a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-5.48 5.48a.492.492 0 0 0 0 .707.499.499 0 0 0 .352.154.51.51 0 0 0 .356-.154l5.833-5.827a1.755 1.755 0 0 0 0-2.481Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Attach files
</span></button>
  
  
</li>
        <li value="" hidden="hidden" data-for="action-bar-fcb290d1-c2b3-402f-9b25-039224df2c63" data-action="click:action-bar#menuItemClick" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <button tabindex="-1" id="item-4fd474c7-78db-4821-afc6-dd0184fe7a0b" type="button" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-mention">
    <path d="M4.75 2.37a6.501 6.501 0 0 0 6.5 11.26.75.75 0 0 1 .75 1.298A7.999 7.999 0 0 1 .989 4.148 8 8 0 0 1 16 7.75v1.5a2.75 2.75 0 0 1-5.072 1.475 3.999 3.999 0 0 1-6.65-4.19A4 4 0 0 1 12 8v1.25a1.25 1.25 0 0 0 2.5 0V7.867a6.5 6.5 0 0 0-9.75-5.496ZM10.5 8a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Mention
</span></button>
  
  
</li>
        <li value="" hidden="hidden" data-for="action-bar-b049945c-ff6b-48c0-9b85-55b15a24e508" data-action="click:action-bar#menuItemClick" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <button tabindex="-1" id="item-54692270-45c1-43cc-89a4-a854abe40d58" type="button" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-cross-reference">
    <path d="M2.75 3.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h4.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 13H9.06l-2.573 2.573A1.458 1.458 0 0 1 4 14.543V13H2.75A1.75 1.75 0 0 1 1 11.25v-7.5C1 2.784 1.784 2 2.75 2h5.5a.75.75 0 0 1 0 1.5ZM16 1.25v4.146a.25.25 0 0 1-.427.177L14.03 4.03l-3.75 3.75a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l3.75-3.75-1.543-1.543A.25.25 0 0 1 11.604 1h4.146a.25.25 0 0 1 .25.25Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Reference
</span></button>
  
  
</li>
        <li value="" hidden="hidden" data-for="action-bar-b32a4083-6a95-481e-b16c-d8786f0c67b8" data-action="click:action-bar#menuItemClick" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <button tabindex="-1" id="item-e401790d-5e31-49c3-a8ac-6b8f4fd491bf" type="button" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-reply">
    <path d="M6.78 1.97a.75.75 0 0 1 0 1.06L3.81 6h6.44A4.75 4.75 0 0 1 15 10.75v2.5a.75.75 0 0 1-1.5 0v-2.5a3.25 3.25 0 0 0-3.25-3.25H3.81l2.97 2.97a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L1.47 7.28a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Saved replies
</span></button>
  
  
</li>
        <li value="" hidden="hidden" data-for="action-bar-73b08e41-d6be-4d65-a587-1e4e7ee7718b" data-action="click:action-bar#menuItemClick" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <button tabindex="-1" id="item-7d89ab33-e8e6-4f53-9dad-582a7fc1b243" type="button" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-diff-ignored">
    <path d="M13.25 1c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 13.25 15H2.75A1.75 1.75 0 0 1 1 13.25V2.75C1 1.784 1.784 1 2.75 1ZM2.75 2.5a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25V2.75a.25.25 0 0 0-.25-.25Zm8.53 3.28-5.5 5.5a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l5.5-5.5a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Slash commands
</span></button>
  
  
</li>
</ul>    
</div></action-list>


</div>
      
</div></anchored-position>  </focus-group>
</action-menu></action-bar></markdown-toolbar>

<dialog-helper>
  <dialog id="saved_replies_menu_issue-2254985370-body-dialog" aria-modal="true" aria-labelledby="saved_replies_menu_issue-2254985370-body-dialog-title" aria-describedby="saved_replies_menu_issue-2254985370-body-dialog-description" data-view-component="true" class="Overlay Overlay-whenNarrow Overlay--size-medium Overlay--motion-scaleFade Overlay--placement-bottom-whenNarrow js-saved-reply-container">
    <div data-view-component="true" class="Overlay-header">
  <div class="Overlay-headerContentWrap">
    <div class="Overlay-titleWrap">
      <h1 class="Overlay-title " id="saved_replies_menu_issue-2254985370-body-dialog-title">
        Select a reply
      </h1>
    </div>
    <div class="Overlay-actionWrap">
      <button data-close-dialog-id="saved_replies_menu_issue-2254985370-body-dialog" aria-label="Close" type="button" data-view-component="true" class="close-button Overlay-closeButton"><svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-x">
    <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path>
</svg></button>
    </div>
  </div>
</div>
      <scrollable-region data-labelled-by="saved_replies_menu_issue-2254985370-body-dialog-title">
        <div data-view-component="true" class="Overlay-body">    <include-fragment class="js-saved-reply-include-fragment" role="menuitem" aria-label="Loading" src="/settings/replies?context=issue" loading="lazy">
      <svg style="box-sizing: content-box; color: var(--color-icon-primary);" width="32" height="32" viewBox="0 0 16 16" fill="none" data-view-component="true" class="my-6 mx-auto d-block anim-rotate">
  <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-opacity="0.25" stroke-width="2" vector-effect="non-scaling-stroke" fill="none" />
  <path d="M15 8a7.002 7.002 0 00-7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke" />
</svg>
    </include-fragment>
</div>
      </scrollable-region>
      <div data-view-component="true" class="Overlay-footer Overlay-footer--alignEnd Overlay-footer--divided">    <a href="/settings/replies?return_to=1" data-view-component="true" class="Button--invisible Button--medium Button Button--fullWidth">  <span class="Button-content Button-content--alignStart">
      <span class="Button-visual Button-leadingVisual">
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-plus">
    <path d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z"></path>
</svg>
      </span>
    <span class="Button-label">Create a new saved reply</span>
  </span>
</a>
</div>
</dialog></dialog-helper>


</div>


    <div class="clearfix"></div>

    <p class="comment-form-error comment-show-stale">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-alert">
    <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"></path>
</svg> The content you are editing has changed.
  Please copy your edits and refresh the page.
</p>


    <file-attachment class="js-upload-markdown-image is-default" input="fc-issue-2254985370-body" data-upload-repository-id="148233297" data-upload-policy-url="/upload/policies/assets"><input type="hidden" value="m7uXj8fqozLCP9bexJBvXKXiIqNejXkIw4C1RPMLuWmt6W65F175aWXsBezEhTEiUN_eI4bSzTmr71zdRjuIxQ" data-csrf="true" class="js-data-upload-policy-url-csrf" />
  <div class="write-content js-write-bucket position-relative m-0">
    <input type="hidden" name="context" value="">
    <input type="text" name="required_field_ef13" hidden="hidden" class="form-control" /><input type="hidden" name="timestamp" value="1713696416574" autocomplete="off" class="form-control" /><input type="hidden" name="timestamp_secret" value="c68d6234ec101c2f10a9d4bb8c397ebf8b1e1af25c9f3a573ebf1995aea22902" autocomplete="off" class="form-control" />

    <input type="hidden" name="issue[id]" value="2254985370">
    <input type="hidden" name="issue[bodyVersion]" class="js-body-version" value="23fe03b4fb4e7439d0966bd8b0b852ff1d144be1bf2f9e626c9d1124066b0d3c">

    <text-expander keys=": @ #"
      data-emoji-url="/autocomplete/emoji"
        data-issue-url="/suggestions/issue/2254985370?issue_suggester=1&amp;repository=test-repository&amp;user_id=HiromiShikata"
        data-mention-url="/suggestions/issue/2254985370?mention_suggester=1&amp;repository=test-repository&amp;user_id=HiromiShikata"
        multiword="#"
    >
        <slash-command-expander
    keys="/"
    data-slash-command-url="/HiromiShikata/test-repository/slash_apps?subject_gid=I_kwDOCNXcUc6GaFia&amp;surface=issue_body"
  >
    <div class="SelectMenu js-slash-command-expander-loading d-none">
      <div class="SelectMenu-modal">
        <header class="SelectMenu-header">
          <div class="flex-1">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-code-square">
    <path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25Zm7.47 3.97a.75.75 0 0 1 1.06 0l2 2a.75.75 0 0 1 0 1.06l-2 2a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L10.69 8 9.22 6.53a.75.75 0 0 1 0-1.06ZM6.78 6.53 5.31 8l1.47 1.47a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215l-2-2a.75.75 0 0 1 0-1.06l2-2a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z"></path>
</svg>

    <span class="color-fg-muted text-small pl-1" >Slash commands</span>
</div>

<div data-view-component="true" class="Label Label--success">Beta</div>
<a class="ml-1 color-fg-muted d-block" target="_blank" rel="noopener noreferrer" href="/feedback/slash-commands">
  Give feedback
</a>

        </header>
        <div class="SelectMenu-loading">
          <svg style="box-sizing: content-box; color: var(--color-icon-primary);" width="32" height="32" viewBox="0 0 16 16" fill="none" data-view-component="true" class="mx-auto d-block anim-rotate">
  <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-opacity="0.25" stroke-width="2" vector-effect="non-scaling-stroke" fill="none" />
  <path d="M15 8a7.002 7.002 0 00-7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke" />
</svg>
        </div>
      </div>
    </div>

    <div class="SelectMenu js-slash-command-expander-error d-none">
      <div class="SelectMenu-modal">
        <header class="SelectMenu-header">
          <div class="flex-1">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-code-square">
    <path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25Zm7.47 3.97a.75.75 0 0 1 1.06 0l2 2a.75.75 0 0 1 0 1.06l-2 2a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L10.69 8 9.22 6.53a.75.75 0 0 1 0-1.06ZM6.78 6.53 5.31 8l1.47 1.47a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215l-2-2a.75.75 0 0 1 0-1.06l2-2a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z"></path>
</svg>

    <span class="color-fg-muted text-small pl-1" >Slash commands</span>
</div>

<div data-view-component="true" class="Label Label--success">Beta</div>
<a class="ml-1 color-fg-muted d-block" target="_blank" rel="noopener noreferrer" href="/feedback/slash-commands">
  Give feedback
</a>

        </header>
        <div class="SelectMenu-list">
          <div class="SelectMenu-blankslate">
            <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-alert color-fg-muted">
    <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"></path>
</svg>
            <h4 class="my-2">An unexpected error has occurred</h4>
          </div>
        </div>
      </div>
    </div>

    
          <div class="CommentBox-container">
            <textarea name="issue[body]"
                      id="issue-2254985370-body"
                      placeholder="Leave a comment"
                      aria-label="Comment body"
                      
                      class="js-comment-field js-paste-markdown js-task-list-field js-quick-submit js-size-to-fit js-session-resumable CommentBox-input FormControl-textarea js-saved-reply-shortcut-comment-field"
                      >Test description
- [ ] checkbox 1
- list item 1
- list item 2
</textarea>
          </div>

  </slash-command-expander>
    </text-expander>
    <input accept=".gif,.jpeg,.jpg,.mov,.mp4,.png,.svg,.webm,.cpuprofile,.csv,.dmp,.docx,.fodg,.fodp,.fods,.fodt,.gz,.json,.jsonc,.log,.md,.odf,.odg,.odp,.ods,.odt,.patch,.pdf,.pptx,.tgz,.txt,.xls,.xlsx,.zip" type="file" multiple hidden id="fc-issue-2254985370-body">
    <div class="file-attachment-errors">
      <x-banner data-dismiss-scheme="none" data-view-component="true">
  <div data-view-component="true" class="rounded-bottom-2 bad-file repository-required Banner flash Banner--error flash-error Banner--full flash-full border-bottom-0">
      <div class="Banner-visual">
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-stop">
    <path d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path>
</svg>
      </div>
    <div data-view-component="true" class="Banner-message">
      <p class="Banner-title" data-target="x-banner.titleText">We don’t support that file type.</p>
        <p>Try again with GIF, JPEG, JPG, MOV, MP4, PNG, SVG, WEBM, CPUPROFILE, CSV, DMP, DOCX, FODG, FODP, FODS, FODT, GZ, JSON, JSONC, LOG, MD, ODF, ODG, ODP, ODS, ODT, PATCH, PDF, PPTX, TGZ, TXT, XLS, XLSX or ZIP.</p>
</div></div></x-banner>
      <x-banner data-dismiss-scheme="none" data-view-component="true">
  <div data-view-component="true" class="rounded-bottom-2 bad-permissions Banner flash Banner--error flash-error Banner--full flash-full border-bottom-0">
      <div class="Banner-visual">
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-stop">
    <path d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path>
</svg>
      </div>
    <div data-view-component="true" class="Banner-message">
      <p class="Banner-title" data-target="x-banner.titleText">Attaching documents requires write permission to this repository.</p>
        <p>Try again with GIF, JPEG, JPG, MOV, MP4, PNG, SVG, WEBM, CPUPROFILE, CSV, DMP, DOCX, FODG, FODP, FODS, FODT, GZ, JSON, JSONC, LOG, MD, ODF, ODG, ODP, ODS, ODT, PATCH, PDF, PPTX, TGZ, TXT, XLS, XLSX or ZIP.</p>
</div></div></x-banner>
      <x-banner data-dismiss-scheme="none" data-view-component="true">
  <div data-view-component="true" class="rounded-bottom-2 too-big js-upload-too-big Banner flash Banner--error flash-error Banner--full flash-full border-bottom-0">
      <div class="Banner-visual">
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-stop">
    <path d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path>
</svg>
      </div>
    <div data-view-component="true" class="Banner-message">
      <p class="Banner-title" data-target="x-banner.titleText"></p>
</div></div></x-banner>
      <x-banner data-dismiss-scheme="none" data-view-component="true">
  <div data-view-component="true" class="rounded-bottom-2 empty Banner flash Banner--error flash-error Banner--full flash-full border-bottom-0">
      <div class="Banner-visual">
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-stop">
    <path d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path>
</svg>
      </div>
    <div data-view-component="true" class="Banner-message">
      <p class="Banner-title" data-target="x-banner.titleText">This file is empty.</p>
        <p>Try again with a file that’s not empty.</p>
</div></div></x-banner>
      <x-banner data-dismiss-scheme="none" data-view-component="true">
  <div data-view-component="true" class="rounded-bottom-2 hidden-file Banner flash Banner--error flash-error Banner--full flash-full border-bottom-0">
      <div class="Banner-visual">
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-stop">
    <path d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path>
</svg>
      </div>
    <div data-view-component="true" class="Banner-message">
      <p class="Banner-title" data-target="x-banner.titleText">This file is hidden.</p>
        <p>Try again with another file.</p>
</div></div></x-banner>
      <x-banner data-dismiss-scheme="none" data-view-component="true">
  <div data-view-component="true" class="rounded-bottom-2 failed-request Banner flash Banner--error flash-error Banner--full flash-full border-bottom-0">
      <div class="Banner-visual">
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-stop">
    <path d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path>
</svg>
      </div>
    <div data-view-component="true" class="Banner-message">
      <p class="Banner-title" data-target="x-banner.titleText">Something went really wrong, and we can’t process that file.</p>
        <p>Try again.</p>
</div></div></x-banner>
    </div>
  </div>
</file-attachment>

    <div class="preview-content">
      <div class="comment js-suggested-changes-container" data-thread-side="">
  <div class="comment-body markdown-body js-preview-body" >
    <p>Nothing to preview</p>
  </div>
</div>

    </div>
  </div>
  <div class="d-flex flex-justify-end flex-items-center flex-wrap mx-2 mb-2 gap-2">

      <div class="flex-auto">
        
      </div>


    <input type="hidden" name="comment_id" value="2254985370" class="js-comment-id">
    <div class="d-flex gap-1">
      <button data-confirm-text="Are you sure you want to discard your unsaved changes?" type="button" data-view-component="true" class="js-comment-cancel-button Button--danger Button--medium Button">  <span class="Button-content">
    <span class="Button-label">Cancel</span>
  </span>
</button>
      <button data-disable-with="" type="submit" data-view-component="true" class="Button--primary Button--medium Button">  <span class="Button-content">
    <span class="Button-label">Update comment</span>
  </span>
</button>

    </div>
  </div>

  <div class="comment-form-error mb-2 js-comment-update-error" hidden></div>
</div>

</form>        <template class="js-convert-to-issue-save-error-toast">
            
<div class="
  position-fixed bottom-0 left-0 ml-5 mb-5
  anim-fade-in fast Toast
   Toast--error"
  role="log"
  style="z-index: 101;">
  <span class="Toast-icon">
      <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-stop">
    <path d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path>
</svg>
  </span>
  <span class="Toast-content d-flex">
    <span>
      We are unable to convert the task to an issue at this time. Please try again.
    </span>
  </span>
    <button class="Toast-dismissButton" type="button" aria-label="Close">
      <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-x">
    <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path>
</svg>
    </button>
</div>

        </template>
        <template hidden class="js-convert-to-issue-update-error-toast">
            
<div class="
  position-fixed bottom-0 left-0 ml-5 mb-5
  anim-fade-in fast Toast
   Toast--warning"
  role="log"
  style="z-index: 101;">
  <span class="Toast-icon">
      <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-alert">
    <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"></path>
</svg>
  </span>
  <span class="Toast-content d-flex">
    <span>
      <span><span>The issue </span><a></a><span> was successfully created but we are unable to update the comment at this time.</span></span>
    </span>
  </span>
    <button class="Toast-dismissButton" type="button" aria-label="Close">
      <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-x">
    <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path>
</svg>
    </button>
</div>

        </template>
    </div>
</div>

</div>


      <div>
    <div id="js-timeline-progressive-loader" data-timeline-item-src="HiromiShikata/test-repository/timeline_focused_item?after_cursor=Y3Vyc29yOnYyOpPPAAABjwA8AuABqzEyNTUwNTY3ODEz&amp;id=I_kwDOCNXcUc6GaFia" ></div>


      <div class="js-timeline-item js-timeline-progressive-focus-container" data-gid="AE_lADOCNXcUc6GaFiazwAAAALsD0ZQ">
  
          <div class="TimelineItem js-targetable-element"  data-team-hovercards-enabled  id="event-12550358608">
  <div class="TimelineItem-badge ">
    <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-person color-fg-inherit">
    <path d="M10.561 8.073a6.005 6.005 0 0 1 3.432 5.142.75.75 0 1 1-1.498.07 4.5 4.5 0 0 0-8.99 0 .75.75 0 0 1-1.498-.07 6.004 6.004 0 0 1 3.431-5.142 3.999 3.999 0 1 1 5.123 0ZM10.5 5a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"></path>
</svg>
  </div>
  <div class="TimelineItem-body">

    

        <a class="d-inline-block" data-hovercard-type="user" data-hovercard-url="/users/HiromiShikata/hovercard" data-octo-click="hovercard-link-click" data-octo-dimensions="link_type:self" href="/HiromiShikata"><img class="avatar avatar-user" src="https://avatars.githubusercontent.com/u/6440811?s=40&amp;v=4" width="20" height="20" alt="@HiromiShikata" /></a>
<a class="author Link--primary text-bold" data-hovercard-type="user" data-hovercard-url="/users/HiromiShikata/hovercard" data-octo-click="hovercard-link-click" data-octo-dimensions="link_type:self" href="/HiromiShikata">HiromiShikata</a>




            self-assigned this


    <a href="#event-12550358608" class="Link--secondary"><relative-time datetime="2024-04-21T09:26:59Z" class="no-wrap">Apr 21, 2024</relative-time></a>

  </div>
</div>


  <div class="TimelineItem js-targetable-element"  data-team-hovercards-enabled  id="event-12550359301">
  <div class="TimelineItem-badge ">
    <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-project color-fg-inherit">
    <path d="M1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25V1.75C0 .784.784 0 1.75 0ZM1.5 1.75v12.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25H1.75a.25.25 0 0 0-.25.25ZM11.75 3a.75.75 0 0 1 .75.75v7.5a.75.75 0 0 1-1.5 0v-7.5a.75.75 0 0 1 .75-.75Zm-8.25.75a.75.75 0 0 1 1.5 0v5.5a.75.75 0 0 1-1.5 0ZM8 3a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 3Z"></path>
</svg>
  </div>
  <div class="TimelineItem-body">

    

        <a class="d-inline-block" data-hovercard-type="user" data-hovercard-url="/users/HiromiShikata/hovercard" data-octo-click="hovercard-link-click" data-octo-dimensions="link_type:self" href="/HiromiShikata"><img class="avatar avatar-user" src="https://avatars.githubusercontent.com/u/6440811?s=40&amp;v=4" width="20" height="20" alt="@HiromiShikata" /></a>
<a class="author Link--primary text-bold" data-hovercard-type="user" data-hovercard-url="/users/HiromiShikata/hovercard" data-octo-click="hovercard-link-click" data-octo-dimensions="link_type:self" href="/HiromiShikata">HiromiShikata</a>




      
  added this to <strong>Inbox</strong>
  in <a href="/HiromiShikata/test-repository/projects/2" class="Link--primary text-bold" >test project 2</a>
    via <span data-view-component="true" class="Label Label--secondary">automation</span>


    <a href="#event-12550359301" class="Link--secondary"><relative-time datetime="2024-04-21T09:27:11Z" class="no-wrap">Apr 21, 2024</relative-time></a>

  </div>
</div>


  <div class="TimelineItem js-targetable-element"  data-team-hovercards-enabled  id="event-7b16488f-ac21-5d46-80ab-043872b28f40">
  <div class="TimelineItem-badge ">
    <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-table color-fg-inherit">
    <path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25ZM6.5 6.5v8h7.75a.25.25 0 0 0 .25-.25V6.5Zm8-1.5V1.75a.25.25 0 0 0-.25-.25H6.5V5Zm-13 1.5v7.75c0 .138.112.25.25.25H5v-8ZM5 5V1.5H1.75a.25.25 0 0 0-.25.25V5Z"></path>
</svg>
  </div>
  <div class="TimelineItem-body">

    

        <a class="d-inline-block" data-hovercard-type="user" data-hovercard-url="/users/HiromiShikata/hovercard" data-octo-click="hovercard-link-click" data-octo-dimensions="link_type:self" href="/HiromiShikata"><img class="avatar avatar-user" src="https://avatars.githubusercontent.com/u/6440811?s=40&amp;v=4" width="20" height="20" alt="@HiromiShikata" /></a>
<a class="author Link--primary text-bold" data-hovercard-type="user" data-hovercard-url="/users/HiromiShikata/hovercard" data-octo-click="hovercard-link-click" data-octo-dimensions="link_type:self" href="/HiromiShikata">HiromiShikata</a>




        added this to <a href="/users/HiromiShikata/projects/49" class="Link--primary text-bold" >V2 project on owner for testing</a>


    <a href="#event-7b16488f-ac21-5d46-80ab-043872b28f40" class="Link--secondary"><relative-time datetime="2024-04-21T09:27:43Z" class="no-wrap">Apr 21, 2024</relative-time></a>

  </div>
</div>


  <div class="TimelineItem js-targetable-element"  data-team-hovercards-enabled  id="event-12550361859">
  <div class="TimelineItem-badge ">
    <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-project color-fg-inherit">
    <path d="M1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25V1.75C0 .784.784 0 1.75 0ZM1.5 1.75v12.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25H1.75a.25.25 0 0 0-.25.25ZM11.75 3a.75.75 0 0 1 .75.75v7.5a.75.75 0 0 1-1.5 0v-7.5a.75.75 0 0 1 .75-.75Zm-8.25.75a.75.75 0 0 1 1.5 0v5.5a.75.75 0 0 1-1.5 0ZM8 3a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 3Z"></path>
</svg>
  </div>
  <div class="TimelineItem-body">

    

        <a class="d-inline-block" data-hovercard-type="user" data-hovercard-url="/users/HiromiShikata/hovercard" data-octo-click="hovercard-link-click" data-octo-dimensions="link_type:self" href="/HiromiShikata"><img class="avatar avatar-user" src="https://avatars.githubusercontent.com/u/6440811?s=40&amp;v=4" width="20" height="20" alt="@HiromiShikata" /></a>
<a class="author Link--primary text-bold" data-hovercard-type="user" data-hovercard-url="/users/HiromiShikata/hovercard" data-octo-click="hovercard-link-click" data-octo-dimensions="link_type:self" href="/HiromiShikata">HiromiShikata</a>




      
  removed this from <strong>Inbox</strong>
  in <a href="/HiromiShikata/test-repository/projects/2" class="Link--primary text-bold" >test project 2</a>


    <a href="#event-12550361859" class="Link--secondary"><relative-time datetime="2024-04-21T09:28:01Z" class="no-wrap">Apr 21, 2024</relative-time></a>

  </div>
</div>


  <div class="TimelineItem js-targetable-element"  data-team-hovercards-enabled  id="event-12550362274">
  <div class="TimelineItem-badge ">
    <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-pencil color-fg-inherit">
    <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Zm.176 4.823L9.75 4.81l-6.286 6.287a.253.253 0 0 0-.064.108l-.558 1.953 1.953-.558a.253.253 0 0 0 .108-.064Zm1.238-3.763a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354Z"></path>
</svg>
  </div>
  <div class="TimelineItem-body">

    

        <a class="d-inline-block" data-hovercard-type="user" data-hovercard-url="/users/HiromiShikata/hovercard" data-octo-click="hovercard-link-click" data-octo-dimensions="link_type:self" href="/HiromiShikata"><img class="avatar avatar-user" src="https://avatars.githubusercontent.com/u/6440811?s=40&amp;v=4" width="20" height="20" alt="@HiromiShikata" /></a>
<a class="author Link--primary text-bold" data-hovercard-type="user" data-hovercard-url="/users/HiromiShikata/hovercard" data-octo-click="hovercard-link-click" data-octo-dimensions="link_type:self" href="/HiromiShikata">HiromiShikata</a>




      changed the title
<del class="text-bold markdown-title">Test title</del>

<ins class="text-bold markdown-title no-underline">In progress test title</ins>


    <a href="#event-12550362274" class="Link--secondary"><relative-time datetime="2024-04-21T09:28:08Z" class="no-wrap">Apr 21, 2024</relative-time></a>

  </div>
</div>


  <div class="TimelineItem js-targetable-element"  data-team-hovercards-enabled  id="event-59c60608-faff-54ef-af30-51a3b555899c">
  <div class="TimelineItem-badge ">
    <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-table color-fg-inherit">
    <path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25ZM6.5 6.5v8h7.75a.25.25 0 0 0 .25-.25V6.5Zm8-1.5V1.75a.25.25 0 0 0-.25-.25H6.5V5Zm-13 1.5v7.75c0 .138.112.25.25.25H5v-8ZM5 5V1.5H1.75a.25.25 0 0 0-.25.25V5Z"></path>
</svg>
  </div>
  <div class="TimelineItem-body">

    

        <a class="d-inline-block" data-hovercard-type="user" data-hovercard-url="/users/HiromiShikata/hovercard" data-octo-click="hovercard-link-click" data-octo-dimensions="link_type:self" href="/HiromiShikata"><img class="avatar avatar-user" src="https://avatars.githubusercontent.com/u/6440811?s=40&amp;v=4" width="20" height="20" alt="@HiromiShikata" /></a>
<a class="author Link--primary text-bold" data-hovercard-type="user" data-hovercard-url="/users/HiromiShikata/hovercard" data-octo-click="hovercard-link-click" data-octo-dimensions="link_type:self" href="/HiromiShikata">HiromiShikata</a>




        moved this to <strong>In Progress</strong>
  in <a href="/users/HiromiShikata/projects/49" class="Link--primary text-bold" >V2 project on owner for testing</a>


    <a href="#event-59c60608-faff-54ef-af30-51a3b555899c" class="Link--secondary"><relative-time datetime="2024-04-21T09:28:15Z" class="no-wrap">Apr 21, 2024</relative-time></a>

  </div>
</div>




</div>

      <div class="js-timeline-item js-timeline-progressive-focus-container" data-gid="IC_kwDOCNXcUc57QtFK">
  
      
<div class="TimelineItem js-comment-container"
      data-gid="IC_kwDOCNXcUc57QtFK"
      data-url="/HiromiShikata/test-repository/comments/IC_kwDOCNXcUc57QtFK/partials/timeline_issue_comment"
      >

  <div class="avatar-parent-child TimelineItem-avatar d-none d-md-block">
  <a class="d-inline-block" data-hovercard-type="user" data-hovercard-url="/users/HiromiShikata/hovercard" data-octo-click="hovercard-link-click" data-octo-dimensions="link_type:self" href="/HiromiShikata"><img class="avatar rounded-2 avatar-user" src="https://avatars.githubusercontent.com/u/6440811?s=80&amp;v=4" width="40" height="40" alt="@HiromiShikata" /></a>

</div>


  <div class="  timeline-comment-group js-minimizable-comment-group js-targetable-element TimelineItem-body my-0 " id="issuecomment-2067976522">

    <div class="ml-n3 timeline-comment unminimized-comment comment previewable-edit js-task-list-container js-comment timeline-comment--caret reorderable-task-lists current-user"
        data-body-version="5488e9494e6e47fb5158f81fb4f27a786a0215e322a802c9a9fc9139fe4c20d1">
      <div class="timeline-comment-header clearfix d-flex"  data-morpheus-enabled="false">
  <div class="timeline-comment-actions flex-shrink-0 d-flex flex-items-center">
    <details class="details-overlay details-reset position-relative d-inline-block">
      <summary data-view-component="true" class="timeline-comment-action Link--secondary Button--link Button--medium Button">  <span class="Button-content">
    <span class="Button-label"><svg aria-label="Show options" role="img" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-kebab-horizontal">
    <path d="M8 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM1.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm13 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"></path>
</svg></span>
  </span>
</summary>

      <details-menu
        class="dropdown-menu dropdown-menu-sw show-more-popover color-fg-default"
        style="width:185px"
        src="/HiromiShikata/test-repository/issue_comments/2067976522/comment_actions_menu?gid=IC_kwDOCNXcUc57QtFK&amp;href=%23issuecomment-2067976522"
        preload
        
      >
          <include-fragment class="js-comment-header-actions-deferred-include-fragment">
            <p class="text-center mt-3" data-hide-on-error>
              <svg aria-label="Loading..." style="box-sizing: content-box; color: var(--color-icon-primary);" width="32" height="32" viewBox="0 0 16 16" fill="none" data-view-component="true" class="anim-rotate">
  <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-opacity="0.25" stroke-width="2" vector-effect="non-scaling-stroke" fill="none" />
  <path d="M15 8a7.002 7.002 0 00-7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke" />
</svg>
            </p>
            <p class="ml-1 mb-2 mt-2" data-show-on-error hidden>
              <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-alert">
    <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"></path>
</svg>
              Sorry, something went wrong.
            </p>
            <button
              type="button"
              class="dropdown-item btn-link js-comment-quote-reply"
              hidden
              data-hotkey="r"
              role="menuitem"
            >
             Quote reply
            </button>
          </include-fragment>
      </details-menu>
    </details>
  </div>

  <div class="d-none d-sm-flex">
      

      

  <span aria-label="You are the owner of the test-repository repository." data-view-component="true" class="tooltipped tooltipped-n">
    <span data-view-component="true" class="Label ml-1">Owner</span>
</span>

      
<span aria-label="You are the author of this issue." data-view-component="true" class="tooltipped tooltipped-n">
  <span data-view-component="true" class="Label ml-1">Author</span>
</span>

  </div>

  <h3 class="f5 text-normal" style="flex: 1 1 auto">
    <div>
      

      <strong>
          <a class="author Link--primary text-bold css-overflow-wrap-anywhere " show_full_name="false" data-hovercard-type="user" data-hovercard-url="/users/HiromiShikata/hovercard" data-octo-click="hovercard-link-click" data-octo-dimensions="link_type:self" href="/HiromiShikata">HiromiShikata</a>
  

      </strong>

      

      commented


        <a href="#issuecomment-2067976522" id="issuecomment-2067976522-permalink" class="Link--secondary js-timestamp"><relative-time datetime="2024-04-21T09:28:24Z" class="no-wrap">Apr 21, 2024</relative-time></a>


      
    </div>

  </h3>
</div>


      <div class="edit-comment-hide">
          <div class="js-minimize-comment d-none js-update-minimized-content">
            

<div class="flash flash-warn flash-full">
  <button class="flash-close js-comment-hide-minimize-form" type="button"><svg aria-label="Cancel hiding comment" aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-x">
    <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path>
</svg></button>
  <h3 class="f4">Choose a reason for hiding this comment</h3>
  <p class="mb-3">The reason will be displayed to describe this comment to others. <a class="Link--inTextBlock" href="https://docs.github.com/articles/managing-disruptive-comments/#hiding-a-comment">Learn more about hiding comments</a>.</p>
  <!-- '"\` --><!-- </textarea></xmp> --></option></form><form class="js-comment-minimize d-md-inline-block d-flex" data-turbo="false" action="/HiromiShikata/test-repository/community/minimize-comment" accept-charset="UTF-8" method="post"><input type="hidden" name="_method" value="put" autocomplete="off" /><input type="hidden" name="authenticity_token" value="SQsthG94FiT6iv4cvcqvA0y9XNoiuiVvrGIu3vRHgsdpMAKNvLglduzmqPfwy3DpciPOCjmzf5uSo5nbPriX8g" />
    <input type="hidden" name="comment_id" value="IC_kwDOCNXcUc57QtFK">
    <select name="classifier" class="form-select mr-2" aria-label="Reason" required>
      <option value>
      Choose a reason
      </option>
      <option value="SPAM">Spam</option>
<option value="ABUSE">Abuse</option>
<option value="OFF_TOPIC">Off Topic</option>
<option value="OUTDATED">Outdated</option>
<option value="DUPLICATE">Duplicate</option>
<option value="RESOLVED">Resolved</option>
    </select>
      <button type="submit" data-view-component="true" class="btn">    Hide
        <span class="d-md-inline-block d-none">comment</span>
</button></form></div>

          </div>

        <task-lists disabled sortable>
<table class="d-block user-select-contain" data-paste-markdown-skip>
  <tbody class="d-block">
    <tr class="d-block">
      <td class="d-block comment-body markdown-body  js-comment-body">
          <p dir="auto">first comment</p>
      </td>
    </tr>
  </tbody>
</table>
</task-lists>


        <div class="d-flex">

            <div class="pr-review-reactions">
              <div data-view-component="true" class="comment-reactions just-bottom js-reactions-container js-reaction-buttons-container social-reactions reactions-container d-flex">
      <reactions-menu tabindex="-1">
    <details
      data-action="toggle:reactions-menu#focusFirstItem"
      data-target="reactions-menu.details"
      class="dropdown details-reset details-overlay d-inline-block new-reactions-dropdown js-reaction-popover-container js-comment-header-reaction-button">
        <summary data-target="reactions-menu.summary" aria-label="Add or remove reactions" aria-haspopup="true" data-view-component="true" class="circle reaction-dropdown-button reaction-dropdown-button--inline btn-invisible btn p-0 mr-1 d-flex flex-justify-center flex-items-center color-bg-subtle border color-border-muted">    <svg height="18" aria-hidden="true" viewBox="0 0 16 16" version="1.1" width="18" data-view-component="true" class="octicon octicon-smiley social-button-emoji">
    <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm3.82 1.636a.75.75 0 0 1 1.038.175l.007.009c.103.118.22.222.35.31.264.178.683.37 1.285.37.602 0 1.02-.192 1.285-.371.13-.088.247-.192.35-.31l.007-.008a.75.75 0 0 1 1.222.87l-.022-.015c.02.013.021.015.021.015v.001l-.001.002-.002.003-.005.007-.014.019a2.066 2.066 0 0 1-.184.213c-.16.166-.338.316-.53.445-.63.418-1.37.638-2.127.629-.946 0-1.652-.308-2.126-.63a3.331 3.331 0 0 1-.715-.657l-.014-.02-.005-.006-.002-.003v-.002h-.001l.613-.432-.614.43a.75.75 0 0 1 .183-1.044ZM12 7a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM5 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm5.25 2.25.592.416a97.71 97.71 0 0 0-.592-.416Z"></path>
</svg>
</summary>        <!-- '"\` --><!-- </textarea></xmp> --></option></form><form class="js-pick-reaction" data-turbo="false" action="/HiromiShikata/test-repository/reactions" accept-charset="UTF-8" method="post"><input type="hidden" name="_method" value="put" autocomplete="off" /><input type="hidden" name="authenticity_token" value="si0dlTcADThqPO6Yx4A6Fbt-Py8XIxg27ptc2EiL2KpSC9wkqV6khUjgIzA03S8986VkUg1otcgz5Bd-1ftv8A" autocomplete="off" />
    <input type="hidden" name="input[subjectId]" value="IC_kwDOCNXcUc57QtFK">
      <input type="hidden" name="input[context]" value="" >
    <ul class="dropdown-menu mt-2 d-flex mb-2 anim-scale-in dropdown-menu-reactions dropdown-menu-ne" role="menu">
        <li role="presentation">
            <button name="input[content]" id="reactions--reaction_button_component-0e93b4" value="THUMBS_UP react" data-reaction-label="+1" data-reaction-content="+1" data-targets="reactions-menu.menuItems" role="menuitemcheckbox" aria-checked="false" aria-label="thumbs up" type="submit" data-view-component="true" class="dropdown-item dropdown-item-reaction btn-invisible btn d-flex no-underline color-fg-muted flex-justify-center flex-items-center rounded-2">    <g-emoji alias="+1" fallback-src="https://github.githubassets.com/assets/1f44d-41cb66fe1e22.png" class="d-flex">👍</g-emoji>
</button>        </li>
        <li role="presentation">
            <button name="input[content]" id="reactions--reaction_button_component-6921dd" value="THUMBS_DOWN react" data-reaction-label="-1" data-reaction-content="-1" data-targets="reactions-menu.menuItems" role="menuitemcheckbox" aria-checked="false" aria-label="thumbs down" type="submit" data-view-component="true" class="dropdown-item dropdown-item-reaction btn-invisible btn d-flex no-underline color-fg-muted flex-justify-center flex-items-center rounded-2">    <g-emoji alias="-1" fallback-src="https://github.githubassets.com/assets/1f44e-ce91733aae25.png" class="d-flex">👎</g-emoji>
</button>        </li>
        <li role="presentation">
            <button name="input[content]" id="reactions--reaction_button_component-80d202" value="LAUGH react" data-reaction-label="Laugh" data-reaction-content="smile" data-targets="reactions-menu.menuItems" role="menuitemcheckbox" aria-checked="false" aria-label="laugh" type="submit" data-view-component="true" class="dropdown-item dropdown-item-reaction btn-invisible btn d-flex no-underline color-fg-muted flex-justify-center flex-items-center rounded-2">    <g-emoji alias="smile" fallback-src="https://github.githubassets.com/assets/1f604-7528822fb4c5.png" class="d-flex">😄</g-emoji>
</button>        </li>
        <li role="presentation">
            <button name="input[content]" id="reactions--reaction_button_component-39a70a" value="HOORAY react" data-reaction-label="Hooray" data-reaction-content="tada" data-targets="reactions-menu.menuItems" role="menuitemcheckbox" aria-checked="false" aria-label="hooray" type="submit" data-view-component="true" class="dropdown-item dropdown-item-reaction btn-invisible btn d-flex no-underline color-fg-muted flex-justify-center flex-items-center rounded-2">    <g-emoji alias="tada" fallback-src="https://github.githubassets.com/assets/1f389-36899a2cb781.png" class="d-flex">🎉</g-emoji>
</button>        </li>
        <li role="presentation">
            <button name="input[content]" id="reactions--reaction_button_component-1c6c62" value="CONFUSED react" data-reaction-label="Confused" data-reaction-content="thinking_face" data-targets="reactions-menu.menuItems" role="menuitemcheckbox" aria-checked="false" aria-label="confused" type="submit" data-view-component="true" class="dropdown-item dropdown-item-reaction btn-invisible btn d-flex no-underline color-fg-muted flex-justify-center flex-items-center rounded-2">    <g-emoji alias="thinking_face" fallback-src="https://github.githubassets.com/assets/1f615-4bb1369c4251.png" class="d-flex">😕</g-emoji>
</button>        </li>
        <li role="presentation">
            <button name="input[content]" id="reactions--reaction_button_component-d4120a" value="HEART react" data-reaction-label="Heart" data-reaction-content="heart" data-targets="reactions-menu.menuItems" role="menuitemcheckbox" aria-checked="false" aria-label="heart" type="submit" data-view-component="true" class="dropdown-item dropdown-item-reaction btn-invisible btn d-flex no-underline color-fg-muted flex-justify-center flex-items-center rounded-2">    <g-emoji alias="heart" fallback-src="https://github.githubassets.com/assets/2764-982dc91ea48a.png" class="d-flex">❤️</g-emoji>
</button>        </li>
        <li role="presentation">
            <button name="input[content]" id="reactions--reaction_button_component-9afde8" value="ROCKET react" data-reaction-label="Rocket" data-reaction-content="rocket" data-targets="reactions-menu.menuItems" role="menuitemcheckbox" aria-checked="false" aria-label="rocket" type="submit" data-view-component="true" class="dropdown-item dropdown-item-reaction btn-invisible btn d-flex no-underline color-fg-muted flex-justify-center flex-items-center rounded-2">    <g-emoji alias="rocket" fallback-src="https://github.githubassets.com/assets/1f680-d0ef47fdb515.png" class="d-flex">🚀</g-emoji>
</button>        </li>
        <li role="presentation">
            <button name="input[content]" id="reactions--reaction_button_component-ba5442" value="EYES react" data-reaction-label="Eyes" data-reaction-content="eyes" data-targets="reactions-menu.menuItems" role="menuitemcheckbox" aria-checked="false" aria-label="eyes" type="submit" data-view-component="true" class="dropdown-item dropdown-item-reaction btn-invisible btn d-flex no-underline color-fg-muted flex-justify-center flex-items-center rounded-2">    <g-emoji alias="eyes" fallback-src="https://github.githubassets.com/assets/1f440-ee44e91e92a7.png" class="d-flex">👀</g-emoji>
</button>        </li>
    </ul>
</form>
    </details>
  </reactions-menu>

  <!-- '"\` --><!-- </textarea></xmp> --></option></form><form class="js-pick-reaction" data-turbo="false" action="/HiromiShikata/test-repository/reactions" accept-charset="UTF-8" method="post"><input type="hidden" name="_method" value="put" autocomplete="off" /><input type="hidden" name="authenticity_token" value="5zXvI5u1FL6OL2cg1cmP3I-0ad2dOIOdkOJ9h_N1OOIHEy6SBeu9A6zzqogmlJr0x28yoIdzLmNNnTYhbgWPuA" autocomplete="off" />
    <input type="hidden" name="input[subjectId]" value="IC_kwDOCNXcUc57QtFK">
      <input type="hidden" name="input[context]" value="" >
    <div  class="js-comment-reactions-options d-flex flex-items-center flex-row flex-wrap">
      <div class="js-reactions-container">
        <details class="dropdown details-reset details-overlay d-inline-block js-all-reactions-popover" hidden>
          <summary aria-haspopup="true" data-view-component="true" class="Button--link Button--medium Button">  <span class="Button-content">
    <span class="Button-label">All reactions</span>
  </span>
</summary>

          <ul class="dropdown-menu dropdown-menu-se">
          </ul>
        </details>
      </div>
    </div>
</form></div>
            </div>
        </div>
      </div>

      <!-- '"\` --><!-- </textarea></xmp> --></option></form><form class="js-comment-update" id="issuecomment-2067976522-edit-form" data-turbo="false" action="/HiromiShikata/test-repository/issue_comments/2067976522" accept-charset="UTF-8" method="post"><input type="hidden" name="_method" value="put" autocomplete="off" /><input type="hidden" name="authenticity_token" value="lnGb3suvFz6Kjbn2CIJzCEHwdwEGgFs5yJXSqRQ4wxUxS7dwPqAaxuGmUNcsB1Zly519aXubNFfV-9yijB692A" />
            <include-fragment
  
  loading="lazy"
  src="/HiromiShikata/test-repository/issue_comments/2067976522/edit_form?textarea_id=issuecomment-2067976522-body&amp;comment_context="
  class="previewable-comment-form js-comment-edit-form-deferred-include-fragment"
>
  <p class="text-center mt-3" data-hide-on-error>
    <svg aria-label="Loading..." style="box-sizing: content-box; color: var(--color-icon-primary);" width="32" height="32" viewBox="0 0 16 16" fill="none" data-view-component="true" class="anim-rotate">
  <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-opacity="0.25" stroke-width="2" vector-effect="non-scaling-stroke" fill="none" />
  <path d="M15 8a7.002 7.002 0 00-7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke" />
</svg>
  </p>
  <p class="ml-1 mb-2 mt-2" data-show-on-error hidden>
    <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-alert">
    <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"></path>
</svg>
    Sorry, something went wrong.
  </p>
</include-fragment>

</form>    </div>
</div>

</div>


</div>


      <div class="js-timeline-item js-timeline-progressive-focus-container" data-gid="0cec729b-1891-5d3e-b463-b10a1f0b9d5d">
  
          <div class="TimelineItem js-targetable-element"  data-team-hovercards-enabled  id="event-0cec729b-1891-5d3e-b463-b10a1f0b9d5d">
  <div class="TimelineItem-badge ">
    <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-table color-fg-inherit">
    <path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25ZM6.5 6.5v8h7.75a.25.25 0 0 0 .25-.25V6.5Zm8-1.5V1.75a.25.25 0 0 0-.25-.25H6.5V5Zm-13 1.5v7.75c0 .138.112.25.25.25H5v-8ZM5 5V1.5H1.75a.25.25 0 0 0-.25.25V5Z"></path>
</svg>
  </div>
  <div class="TimelineItem-body">

    

        <a class="d-inline-block" data-hovercard-type="user" data-hovercard-url="/users/HiromiShikata/hovercard" data-octo-click="hovercard-link-click" data-octo-dimensions="link_type:self" href="/HiromiShikata"><img class="avatar avatar-user" src="https://avatars.githubusercontent.com/u/6440811?s=40&amp;v=4" width="20" height="20" alt="@HiromiShikata" /></a>
<a class="author Link--primary text-bold" data-hovercard-type="user" data-hovercard-url="/users/HiromiShikata/hovercard" data-octo-click="hovercard-link-click" data-octo-dimensions="link_type:self" href="/HiromiShikata">HiromiShikata</a>




        moved this from <strong>In Progress</strong>
  to <strong>Todo</strong>
  in <a href="/users/HiromiShikata/projects/49" class="Link--primary text-bold" >V2 project on owner for testing</a>


    <a href="#event-0cec729b-1891-5d3e-b463-b10a1f0b9d5d" class="Link--secondary"><relative-time datetime="2024-04-21T09:31:46Z" class="no-wrap">Apr 21, 2024</relative-time></a>

  </div>
</div>


  <div class="TimelineItem js-targetable-element"  data-team-hovercards-enabled  id="event-450d6392-7d48-5073-9733-601e34d0fbdc">
  <div class="TimelineItem-badge ">
    <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-table color-fg-inherit">
    <path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25ZM6.5 6.5v8h7.75a.25.25 0 0 0 .25-.25V6.5Zm8-1.5V1.75a.25.25 0 0 0-.25-.25H6.5V5Zm-13 1.5v7.75c0 .138.112.25.25.25H5v-8ZM5 5V1.5H1.75a.25.25 0 0 0-.25.25V5Z"></path>
</svg>
  </div>
  <div class="TimelineItem-body">

    

        <a class="d-inline-block" data-hovercard-type="user" data-hovercard-url="/users/HiromiShikata/hovercard" data-octo-click="hovercard-link-click" data-octo-dimensions="link_type:self" href="/HiromiShikata"><img class="avatar avatar-user" src="https://avatars.githubusercontent.com/u/6440811?s=40&amp;v=4" width="20" height="20" alt="@HiromiShikata" /></a>
<a class="author Link--primary text-bold" data-hovercard-type="user" data-hovercard-url="/users/HiromiShikata/hovercard" data-octo-click="hovercard-link-click" data-octo-dimensions="link_type:self" href="/HiromiShikata">HiromiShikata</a>




        moved this from <strong>Todo</strong>
  to <strong>In Progress</strong>
  in <a href="/users/HiromiShikata/projects/49" class="Link--primary text-bold" >V2 project on owner for testing</a>


    <a href="#event-450d6392-7d48-5073-9733-601e34d0fbdc" class="Link--secondary"><relative-time datetime="2024-04-21T10:13:07Z" class="no-wrap">Apr 21, 2024</relative-time></a>

  </div>
</div>


  <div class="TimelineItem js-targetable-element"  data-team-hovercards-enabled  id="event-12550567813">
  <div class="TimelineItem-badge ">
    <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-tag color-fg-inherit">
    <path d="M1 7.775V2.75C1 1.784 1.784 1 2.75 1h5.025c.464 0 .91.184 1.238.513l6.25 6.25a1.75 1.75 0 0 1 0 2.474l-5.026 5.026a1.75 1.75 0 0 1-2.474 0l-6.25-6.25A1.752 1.752 0 0 1 1 7.775Zm1.5 0c0 .066.026.13.073.177l6.25 6.25a.25.25 0 0 0 .354 0l5.025-5.025a.25.25 0 0 0 0-.354l-6.25-6.25a.25.25 0 0 0-.177-.073H2.75a.25.25 0 0 0-.25.25ZM6 5a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z"></path>
</svg>
  </div>
  <div class="TimelineItem-body">

    

        <a class="d-inline-block" data-hovercard-type="user" data-hovercard-url="/users/HiromiShikata/hovercard" data-octo-click="hovercard-link-click" data-octo-dimensions="link_type:self" href="/HiromiShikata"><img class="avatar avatar-user" src="https://avatars.githubusercontent.com/u/6440811?s=40&amp;v=4" width="20" height="20" alt="@HiromiShikata" /></a>
<a class="author Link--primary text-bold" data-hovercard-type="user" data-hovercard-url="/users/HiromiShikata/hovercard" data-octo-click="hovercard-link-click" data-octo-dimensions="link_type:self" href="/HiromiShikata">HiromiShikata</a>




        added
  the 
<a id="label-35e259" href="/HiromiShikata/test-repository/labels/enhancement" data-name="enhancement" style="--label-r:162;--label-g:238;--label-b:239;--label-h:180;--label-s:70;--label-l:78;" data-view-component="true" class="IssueLabel hx_IssueLabel d-inline-block v-align-middle">
  enhancement
</a>
  <tool-tip id="tooltip-acc54461-0842-415c-84f6-9e85c5196cc3" for="label-35e259" popover="manual" data-direction="s" data-type="description" data-view-component="true" class="sr-only position-absolute">New feature or request</tool-tip>
 label


    <a href="#event-12550567813" class="Link--secondary"><relative-time datetime="2024-04-21T10:38:04Z" class="no-wrap">Apr 21, 2024</relative-time></a>

  </div>
</div>




</div>





  <!-- Rendered timeline since 2024-04-21 03:38:04 -->
  <div class="js-timeline-marker js-socket-channel js-updatable-content"
        id="partial-timeline"
        data-channel="eyJjIjoiaXNzdWU6MjI1NDk4NTM3MCIsInQiOjE3MTM2OTY0MTZ9--607be4872015f7956def485e4f24a9291857cbb6b2944964b7cdc4b0495a44e0"
        data-url="/HiromiShikata/test-repository/issues/38/partials/unread_timeline?issue=38&amp;since=2024-04-21T03%3A38%3A04.000000000-07%3A00"
        data-last-modified="2024-04-21T03:38:04.000000000-07:00"
        data-morpheus-enabled="false"
        data-gid="I_kwDOCNXcUc6GaFia">
    <!-- '"\` --><!-- </textarea></xmp> --></option></form><form class="d-none js-timeline-marker-form" data-turbo="false" action="/_graphql/MarkNotificationSubjectAsRead" accept-charset="UTF-8" data-remote="true" method="post"><input type="hidden" name="authenticity_token" value="8o6Pie7TvCHw6H91WBazXpDjypoQmiTTIp8bVXXTh_KDyZFgCXDW4itYfyXs14eHXSAmPoqsYQZwinmELByqPA" />
      <input type="hidden" name="variables[subjectId]" value="I_kwDOCNXcUc6GaFia">
</form>  </div>
</div>


  </div>



  <span id="issue-comment-box"></span>
  <div class="discussion-timeline-actions">
            <div class="timeline-comment-wrapper timeline-new-comment js-comment-container js-targetable-element ml-0 pl-0 ml-md-6 pl-md-3" id="issuecomment-new">
  <div class="d-none d-md-block">
  <span class="timeline-comment-avatar "><a class="d-inline-block" data-hovercard-type="user" data-hovercard-url="/users/HiromiShikata/hovercard" data-octo-click="hovercard-link-click" data-octo-dimensions="link_type:self" href="/HiromiShikata"><img class="avatar avatar-user" src="https://avatars.githubusercontent.com/u/6440811?s=80&amp;v=4" width="40" height="40" alt="@HiromiShikata" /></a></span>
  </div>
    <div>
      <!-- '"\` --><!-- </textarea></xmp> --></option></form><form id="new_comment_form" aria-labelledby="previewable-comment-form-component-c483ee56-f067-471c-bcc3-b2d0def6eab4-title" autocomplete="off" class="js-new-comment-form js-needs-timeline-marker-header" data-turbo="false" action="/HiromiShikata/test-repository/issue_comments" accept-charset="UTF-8" method="post"><input type="hidden" name="authenticity_token" value="2AWPvQbcrcOD4sw3KrFldASS4Nxu3oQFhtQSYAWl5Hex5xX-5oful4JFc-ZTH5rQ8MxAXt9zjc6_INTrHioicg" />
        <input type="text" name="required_field_5200" hidden="hidden" class="form-control" /><input type="hidden" name="timestamp" value="1713696416601" autocomplete="off" class="form-control" /><input type="hidden" name="timestamp_secret" value="9f899d658d639208bdf96bffc8d27f3e14b29234093eedfc13d622274b865140" autocomplete="off" class="form-control" />
        <input type="hidden" name="issue" value="38">
          <fieldset class="min-width-0">
              
<div data-view-component="true"><legend data-view-component="true"><h4 id="previewable-comment-form-component-c483ee56-f067-471c-bcc3-b2d0def6eab4-title" data-view-component="true" class="f4 mb-2">Add a comment</h4></legend></div>
<label for="new_comment_field" data-view-component="true" class="sr-only position-absolute">Comment</label>
<tab-container class="js-previewable-comment-form write-selected Box CommentBox" data-preview-url="/preview?markdown_unsupported=false&amp;repository=148233297&amp;subject=38&amp;subject_type=Issue">
  <input type="hidden" value="xqzaNeiPV0OsaEu-_CrD3VBTiWReU9xvLzulVOSD1TqejqyWR_PHmZhGr9P8-u5_CwMIuC1x8yj3y6h-HKIXLQ" data-csrf="true" class="js-data-preview-url-csrf" />
  <div class="tabnav CommentBox-header">
      <div
        class="tabnav-tabs"
        role="tablist"
        aria-label="Add a comment"
      >
        <button
          type="button"
          class="btn-link tabnav-tab write-tab js-write-tab"
          role="tab"
          id="write_tab_previewable-comment-form-component-c483ee56-f067-471c-bcc3-b2d0def6eab4"
          data-analytics-event="{&quot;category&quot;:&quot;comment_box&quot;,&quot;action&quot;:&quot;WRITE_TAB&quot;,&quot;label&quot;:null}"
          aria-selected="true"
        >
          Write
        </button>
        <button
          type="button"
          class="btn-link tabnav-tab preview-tab js-preview-tab"
          role="tab"
          id="preview_tab_previewable-comment-form-component-c483ee56-f067-471c-bcc3-b2d0def6eab4"
          data-analytics-event="{&quot;category&quot;:&quot;comment_box&quot;,&quot;action&quot;:&quot;PREVIEW_TAB&quot;,&quot;label&quot;:null}"
        >
          Preview
        </button>
      </div>
    <markdown-toolbar role="presentation" for="new_comment_field" data-no-focus="true" data-view-component="true" class="CommentBox-toolbar">
  <action-bar role="toolbar" data-view-component="true" class="ActionBar">
  <div data-target="action-bar.itemContainer" data-view-component="true" class="ActionBar-item-container">
      <div data-targets="action-bar.items" data-view-component="true" class="ActionBar-item"><button id="action-bar-0c16672f-4331-4018-8906-337d440c6121" data-md-button="header-3" data-analytics-event="{&quot;category&quot;:&quot;comment_box&quot;,&quot;action&quot;:&quot;HEADING&quot;,&quot;label&quot;:null}" aria-labelledby="tooltip-d5184530-2340-4d69-bb4f-98813f82ba70" type="button" data-view-component="true" class="Button Button--iconOnly Button--invisible Button--medium">  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-heading Button-visual">
    <path d="M3.75 2a.75.75 0 0 1 .75.75V7h7V2.75a.75.75 0 0 1 1.5 0v10.5a.75.75 0 0 1-1.5 0V8.5h-7v4.75a.75.75 0 0 1-1.5 0V2.75A.75.75 0 0 1 3.75 2Z"></path>
</svg>
</button><tool-tip id="tooltip-d5184530-2340-4d69-bb4f-98813f82ba70" for="action-bar-0c16672f-4331-4018-8906-337d440c6121" popover="manual" data-direction="s" data-type="label" data-view-component="true" class="sr-only position-absolute">Heading</tool-tip>
</div>
      <div data-targets="action-bar.items" data-view-component="true" class="ActionBar-item"><button id="action-bar-ab877954-950b-4725-9b8e-0f41dd42ee2e" data-md-button="bold" data-hotkey-scope="new_comment_field" data-hotkey="Control+b" data-analytics-event="{&quot;category&quot;:&quot;comment_box&quot;,&quot;action&quot;:&quot;BOLD&quot;,&quot;label&quot;:null}" aria-labelledby="tooltip-93577251-ed30-464d-8764-6a8f7b948199" type="button" data-view-component="true" class="Button Button--iconOnly Button--invisible Button--medium">  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-bold Button-visual">
    <path d="M4 2h4.5a3.501 3.501 0 0 1 2.852 5.53A3.499 3.499 0 0 1 9.5 14H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm1 7v3h4.5a1.5 1.5 0 0 0 0-3Zm3.5-2a1.5 1.5 0 0 0 0-3H5v3Z"></path>
</svg>
</button><tool-tip id="tooltip-93577251-ed30-464d-8764-6a8f7b948199" for="action-bar-ab877954-950b-4725-9b8e-0f41dd42ee2e" popover="manual" data-direction="s" data-type="label" data-view-component="true" class="sr-only position-absolute">Bold</tool-tip>
</div>
      <div data-targets="action-bar.items" data-view-component="true" class="ActionBar-item"><button id="action-bar-2bda957d-2650-4ff6-8ffa-9c77ae6a28fa" data-md-button="italic" data-hotkey-scope="new_comment_field" data-hotkey="Control+i" data-analytics-event="{&quot;category&quot;:&quot;comment_box&quot;,&quot;action&quot;:&quot;ITALIC&quot;,&quot;label&quot;:null}" aria-labelledby="tooltip-970f0a20-4721-411d-b073-d0db4586fd29" type="button" data-view-component="true" class="Button Button--iconOnly Button--invisible Button--medium">  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-italic Button-visual">
    <path d="M6 2.75A.75.75 0 0 1 6.75 2h6.5a.75.75 0 0 1 0 1.5h-2.505l-3.858 9H9.25a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1 0-1.5h2.505l3.858-9H6.75A.75.75 0 0 1 6 2.75Z"></path>
</svg>
</button><tool-tip id="tooltip-970f0a20-4721-411d-b073-d0db4586fd29" for="action-bar-2bda957d-2650-4ff6-8ffa-9c77ae6a28fa" popover="manual" data-direction="s" data-type="label" data-view-component="true" class="sr-only position-absolute">Italic</tool-tip>
</div>
      <div data-targets="action-bar.items" data-view-component="true" class="ActionBar-item"><button id="action-bar-f0e13c28-cd82-4bc1-b7d7-8fe002af3f85" data-md-button="quote" data-hotkey-scope="new_comment_field" data-hotkey="Control+Shift+&gt;" data-analytics-event="{&quot;category&quot;:&quot;comment_box&quot;,&quot;action&quot;:&quot;QUOTE&quot;,&quot;label&quot;:null}" aria-labelledby="tooltip-eef4148e-a616-428d-976e-1b2dda9c950f" type="button" data-view-component="true" class="Button Button--iconOnly Button--invisible Button--medium">  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-quote Button-visual">
    <path d="M1.75 2.5h10.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1 0-1.5Zm4 5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5Zm0 5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5ZM2.5 7.75v6a.75.75 0 0 1-1.5 0v-6a.75.75 0 0 1 1.5 0Z"></path>
</svg>
</button><tool-tip id="tooltip-eef4148e-a616-428d-976e-1b2dda9c950f" for="action-bar-f0e13c28-cd82-4bc1-b7d7-8fe002af3f85" popover="manual" data-direction="s" data-type="label" data-view-component="true" class="sr-only position-absolute">Quote</tool-tip>
</div>
      <div data-targets="action-bar.items" data-view-component="true" class="ActionBar-item"><button id="action-bar-ce96d6dd-9fcc-45d5-b0b8-cd23249f4853" data-md-button="code" data-hotkey-scope="new_comment_field" data-hotkey="Control+e" data-analytics-event="{&quot;category&quot;:&quot;comment_box&quot;,&quot;action&quot;:&quot;CODE&quot;,&quot;label&quot;:null}" aria-labelledby="tooltip-4ad2a187-0811-4752-b9e6-7e96da68fdbf" type="button" data-view-component="true" class="Button Button--iconOnly Button--invisible Button--medium">  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-code Button-visual">
    <path d="m11.28 3.22 4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L13.94 8l-3.72-3.72a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215Zm-6.56 0a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L2.06 8l3.72 3.72a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L.47 8.53a.75.75 0 0 1 0-1.06Z"></path>
</svg>
</button><tool-tip id="tooltip-4ad2a187-0811-4752-b9e6-7e96da68fdbf" for="action-bar-ce96d6dd-9fcc-45d5-b0b8-cd23249f4853" popover="manual" data-direction="s" data-type="label" data-view-component="true" class="sr-only position-absolute">Code</tool-tip>
</div>
      <div data-targets="action-bar.items" data-view-component="true" class="ActionBar-item"><button id="action-bar-9fe239c7-2b66-44d7-928b-d7726181effb" data-md-button="link" data-hotkey-scope="new_comment_field" data-hotkey="Control+k" data-analytics-event="{&quot;category&quot;:&quot;comment_box&quot;,&quot;action&quot;:&quot;LINK&quot;,&quot;label&quot;:null}" aria-labelledby="tooltip-8c912773-644b-4cd3-8ab2-8249b86e01d6" type="button" data-view-component="true" class="Button Button--iconOnly Button--invisible Button--medium">  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-link Button-visual">
    <path d="m7.775 3.275 1.25-1.25a3.5 3.5 0 1 1 4.95 4.95l-2.5 2.5a3.5 3.5 0 0 1-4.95 0 .751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018 1.998 1.998 0 0 0 2.83 0l2.5-2.5a2.002 2.002 0 0 0-2.83-2.83l-1.25 1.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042Zm-4.69 9.64a1.998 1.998 0 0 0 2.83 0l1.25-1.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-1.25 1.25a3.5 3.5 0 1 1-4.95-4.95l2.5-2.5a3.5 3.5 0 0 1 4.95 0 .751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018 1.998 1.998 0 0 0-2.83 0l-2.5 2.5a1.998 1.998 0 0 0 0 2.83Z"></path>
</svg>
</button><tool-tip id="tooltip-8c912773-644b-4cd3-8ab2-8249b86e01d6" for="action-bar-9fe239c7-2b66-44d7-928b-d7726181effb" popover="manual" data-direction="s" data-type="label" data-view-component="true" class="sr-only position-absolute">Link</tool-tip>
</div>
      <hr role="presentation" aria-hidden="true" data-targets="action-bar.items" data-view-component="true" class="ActionBar-item ActionBar-divider" />
      <div data-targets="action-bar.items" data-view-component="true" class="ActionBar-item"><button id="action-bar-04484f9b-92d8-4b16-acbf-744fdacfd043" data-md-button="ordered-list" data-hotkey-scope="new_comment_field" data-hotkey="Control+Shift+&amp;" data-analytics-event="{&quot;category&quot;:&quot;comment_box&quot;,&quot;action&quot;:&quot;ORDERED_LIST&quot;,&quot;label&quot;:null}" aria-labelledby="tooltip-f0ec8deb-9a4d-4c06-b0f1-57440e27a66f" type="button" data-view-component="true" class="Button Button--iconOnly Button--invisible Button--medium">  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-list-ordered Button-visual">
    <path d="M5 3.25a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 5 3.25Zm0 5a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 5 8.25Zm0 5a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1-.75-.75ZM.924 10.32a.5.5 0 0 1-.851-.525l.001-.001.001-.002.002-.004.007-.011c.097-.144.215-.273.348-.384.228-.19.588-.392 1.068-.392.468 0 .858.181 1.126.484.259.294.377.673.377 1.038 0 .987-.686 1.495-1.156 1.845l-.047.035c-.303.225-.522.4-.654.597h1.357a.5.5 0 0 1 0 1H.5a.5.5 0 0 1-.5-.5c0-1.005.692-1.52 1.167-1.875l.035-.025c.531-.396.8-.625.8-1.078a.57.57 0 0 0-.128-.376C1.806 10.068 1.695 10 1.5 10a.658.658 0 0 0-.429.163.835.835 0 0 0-.144.153ZM2.003 2.5V6h.503a.5.5 0 0 1 0 1H.5a.5.5 0 0 1 0-1h.503V3.308l-.28.14a.5.5 0 0 1-.446-.895l1.003-.5a.5.5 0 0 1 .723.447Z"></path>
</svg>
</button><tool-tip id="tooltip-f0ec8deb-9a4d-4c06-b0f1-57440e27a66f" for="action-bar-04484f9b-92d8-4b16-acbf-744fdacfd043" popover="manual" data-direction="s" data-type="label" data-view-component="true" class="sr-only position-absolute">Numbered list</tool-tip>
</div>
      <div data-targets="action-bar.items" data-view-component="true" class="ActionBar-item"><button id="action-bar-c31b2839-4335-4fbc-b734-1428f1b969d7" data-md-button="unordered-list" data-hotkey-scope="new_comment_field" data-hotkey="Control+Shift+*" data-analytics-event="{&quot;category&quot;:&quot;comment_box&quot;,&quot;action&quot;:&quot;UNORDERED_LIST&quot;,&quot;label&quot;:null}" aria-labelledby="tooltip-90ef84ba-049b-4729-9464-ce4b088e3bfb" type="button" data-view-component="true" class="Button Button--iconOnly Button--invisible Button--medium">  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-list-unordered Button-visual">
    <path d="M5.75 2.5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5Zm0 5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5Zm0 5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5ZM2 14a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm1-6a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM2 4a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path>
</svg>
</button><tool-tip id="tooltip-90ef84ba-049b-4729-9464-ce4b088e3bfb" for="action-bar-c31b2839-4335-4fbc-b734-1428f1b969d7" popover="manual" data-direction="s" data-type="label" data-view-component="true" class="sr-only position-absolute">Unordered list</tool-tip>
</div>
      <div data-targets="action-bar.items" data-view-component="true" class="ActionBar-item"><button id="action-bar-d8b60157-23c9-4e4e-b1df-8e74a83929f3" data-md-button="task-list" data-hotkey-scope="new_comment_field" data-hotkey="Control+Shift+L" data-analytics-event="{&quot;category&quot;:&quot;comment_box&quot;,&quot;action&quot;:&quot;TASK_LIST&quot;,&quot;label&quot;:null}" aria-labelledby="tooltip-0dcb6056-b757-4371-8047-0c8f7a33d9bc" type="button" data-view-component="true" class="Button Button--iconOnly Button--invisible Button--medium">  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-tasklist Button-visual">
    <path d="M2 2h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm4.655 8.595a.75.75 0 0 1 0 1.06L4.03 14.28a.75.75 0 0 1-1.06 0l-1.5-1.5a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215l.97.97 2.095-2.095a.75.75 0 0 1 1.06 0ZM9.75 2.5h5.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1 0-1.5Zm0 5h5.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1 0-1.5Zm0 5h5.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1 0-1.5Zm-7.25-9v3h3v-3Z"></path>
</svg>
</button><tool-tip id="tooltip-0dcb6056-b757-4371-8047-0c8f7a33d9bc" for="action-bar-d8b60157-23c9-4e4e-b1df-8e74a83929f3" popover="manual" data-direction="s" data-type="label" data-view-component="true" class="sr-only position-absolute">Task list</tool-tip>
</div>
      <hr role="presentation" aria-hidden="true" data-targets="action-bar.items" data-view-component="true" class="ActionBar-item ActionBar-divider" />
      <div data-targets="action-bar.items" data-view-component="true" class="ActionBar-item"><button id="action-bar-6e1cb5f2-b65c-4ce9-8c3a-39c6851cec95" data-analytics-event="{&quot;category&quot;:&quot;comment_box&quot;,&quot;action&quot;:&quot;ATTACH_FILES&quot;,&quot;label&quot;:null}" data-file-attachment-for="fc-new_comment_field" aria-labelledby="tooltip-b0acbf3f-9ad6-4ae5-851d-5f98868763e7" type="button" data-view-component="true" class="Button Button--iconOnly Button--invisible Button--medium">  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-paperclip Button-visual">
    <path d="M12.212 3.02a1.753 1.753 0 0 0-2.478.003l-5.83 5.83a3.007 3.007 0 0 0-.88 2.127c0 .795.315 1.551.88 2.116.567.567 1.333.89 2.126.89.79 0 1.548-.321 2.116-.89l5.48-5.48a.75.75 0 0 1 1.061 1.06l-5.48 5.48a4.492 4.492 0 0 1-3.177 1.33c-1.2 0-2.345-.487-3.187-1.33a4.483 4.483 0 0 1-1.32-3.177c0-1.195.475-2.341 1.32-3.186l5.83-5.83a3.25 3.25 0 0 1 5.553 2.297c0 .863-.343 1.691-.953 2.301L7.439 12.39c-.375.377-.884.59-1.416.593a1.998 1.998 0 0 1-1.412-.593 1.992 1.992 0 0 1 0-2.828l5.48-5.48a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-5.48 5.48a.492.492 0 0 0 0 .707.499.499 0 0 0 .352.154.51.51 0 0 0 .356-.154l5.833-5.827a1.755 1.755 0 0 0 0-2.481Z"></path>
</svg>
</button><tool-tip id="tooltip-b0acbf3f-9ad6-4ae5-851d-5f98868763e7" for="action-bar-6e1cb5f2-b65c-4ce9-8c3a-39c6851cec95" popover="manual" data-direction="s" data-type="label" data-view-component="true" class="sr-only position-absolute">Attach files</tool-tip>
</div>
      <div data-targets="action-bar.items" data-view-component="true" class="ActionBar-item"><button id="action-bar-371fc0bb-c80a-4cbe-afcd-9ce4d530f69f" data-md-button="mention" data-analytics-event="{&quot;category&quot;:&quot;comment_box&quot;,&quot;action&quot;:&quot;MENTION&quot;,&quot;label&quot;:null}" aria-labelledby="tooltip-42c178d1-f299-4452-967c-3c641fc73735" type="button" data-view-component="true" class="Button Button--iconOnly Button--invisible Button--medium">  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-mention Button-visual">
    <path d="M4.75 2.37a6.501 6.501 0 0 0 6.5 11.26.75.75 0 0 1 .75 1.298A7.999 7.999 0 0 1 .989 4.148 8 8 0 0 1 16 7.75v1.5a2.75 2.75 0 0 1-5.072 1.475 3.999 3.999 0 0 1-6.65-4.19A4 4 0 0 1 12 8v1.25a1.25 1.25 0 0 0 2.5 0V7.867a6.5 6.5 0 0 0-9.75-5.496ZM10.5 8a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"></path>
</svg>
</button><tool-tip id="tooltip-42c178d1-f299-4452-967c-3c641fc73735" for="action-bar-371fc0bb-c80a-4cbe-afcd-9ce4d530f69f" popover="manual" data-direction="s" data-type="label" data-view-component="true" class="sr-only position-absolute">Mention</tool-tip>
</div>
      <div data-targets="action-bar.items" data-view-component="true" class="ActionBar-item"><button id="action-bar-9ee02cac-b207-4807-8514-877d7cb4855c" data-md-button="ref" data-analytics-event="{&quot;category&quot;:&quot;comment_box&quot;,&quot;action&quot;:&quot;REFERENCE&quot;,&quot;label&quot;:null}" aria-labelledby="tooltip-851efd58-e784-4316-b9cb-5272c5839410" type="button" data-view-component="true" class="Button Button--iconOnly Button--invisible Button--medium">  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-cross-reference Button-visual">
    <path d="M2.75 3.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h4.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 13H9.06l-2.573 2.573A1.458 1.458 0 0 1 4 14.543V13H2.75A1.75 1.75 0 0 1 1 11.25v-7.5C1 2.784 1.784 2 2.75 2h5.5a.75.75 0 0 1 0 1.5ZM16 1.25v4.146a.25.25 0 0 1-.427.177L14.03 4.03l-3.75 3.75a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l3.75-3.75-1.543-1.543A.25.25 0 0 1 11.604 1h4.146a.25.25 0 0 1 .25.25Z"></path>
</svg>
</button><tool-tip id="tooltip-851efd58-e784-4316-b9cb-5272c5839410" for="action-bar-9ee02cac-b207-4807-8514-877d7cb4855c" popover="manual" data-direction="s" data-type="label" data-view-component="true" class="sr-only position-absolute">Reference</tool-tip>
</div>
      <div data-targets="action-bar.items" data-view-component="true" class="ActionBar-item"><button id="action-bar-968a5f6e-838d-4a39-b5c9-00dba61c3edc" data-show-dialog-id="saved_replies_menu_new_comment_field-dialog" data-analytics-event="{&quot;category&quot;:&quot;comment_box&quot;,&quot;action&quot;:&quot;SAVED_REPLIES&quot;,&quot;label&quot;:null}" aria-labelledby="tooltip-df1f8fe5-b7de-4302-aae0-ebd171f46962" type="button" data-view-component="true" class="Button Button--iconOnly Button--invisible Button--medium">  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-reply Button-visual">
    <path d="M6.78 1.97a.75.75 0 0 1 0 1.06L3.81 6h6.44A4.75 4.75 0 0 1 15 10.75v2.5a.75.75 0 0 1-1.5 0v-2.5a3.25 3.25 0 0 0-3.25-3.25H3.81l2.97 2.97a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L1.47 7.28a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"></path>
</svg>
</button><tool-tip id="tooltip-df1f8fe5-b7de-4302-aae0-ebd171f46962" for="action-bar-968a5f6e-838d-4a39-b5c9-00dba61c3edc" popover="manual" data-direction="s" data-type="label" data-view-component="true" class="sr-only position-absolute">Saved replies</tool-tip>
</div>
      <slash-command-toolbar-button data-targets="action-bar.items" data-view-component="true" class="ActionBar-item"><button id="action-bar-9442f0f2-19e3-4b3f-baa5-dcae647b437b" data-action="click:slash-command-toolbar-button#triggerMenu" data-analytics-event="{&quot;category&quot;:&quot;comment_box&quot;,&quot;action&quot;:&quot;SLASH_COMMANDS&quot;,&quot;label&quot;:null}" aria-labelledby="tooltip-065da486-df26-44da-a2e0-927e94aea51e" type="button" data-view-component="true" class="Button Button--iconOnly Button--invisible Button--medium">  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-diff-ignored Button-visual">
    <path d="M13.25 1c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 13.25 15H2.75A1.75 1.75 0 0 1 1 13.25V2.75C1 1.784 1.784 1 2.75 1ZM2.75 2.5a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25V2.75a.25.25 0 0 0-.25-.25Zm8.53 3.28-5.5 5.5a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l5.5-5.5a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z"></path>
</svg>
</button><tool-tip id="tooltip-065da486-df26-44da-a2e0-927e94aea51e" for="action-bar-9442f0f2-19e3-4b3f-baa5-dcae647b437b" popover="manual" data-direction="s" data-type="label" data-view-component="true" class="sr-only position-absolute">Slash commands</tool-tip>
</slash-command-toolbar-button>
</div>    <action-menu data-target="action-bar.moreMenu" hidden="hidden" data-select-variant="none" data-view-component="true" class="ActionBar-more-menu">
  <focus-group direction="vertical" mnemonics retain>
    <button id="action-bar-09931a7c-fbfd-4005-9c11-2d6f2d8bd0eb-button" popovertarget="action-bar-09931a7c-fbfd-4005-9c11-2d6f2d8bd0eb-overlay" aria-controls="action-bar-09931a7c-fbfd-4005-9c11-2d6f2d8bd0eb-list" aria-haspopup="true" aria-labelledby="tooltip-ebfb6821-afb8-44c2-80e6-9c5c8aa642c7" type="button" data-view-component="true" class="Button Button--iconOnly Button--invisible Button--medium">  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-kebab-horizontal Button-visual">
    <path d="M8 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM1.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm13 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"></path>
</svg>
</button><tool-tip id="tooltip-ebfb6821-afb8-44c2-80e6-9c5c8aa642c7" for="action-bar-09931a7c-fbfd-4005-9c11-2d6f2d8bd0eb-button" popover="manual" data-direction="s" data-type="label" data-view-component="true" class="sr-only position-absolute">Menu</tool-tip>


<anchored-position id="action-bar-09931a7c-fbfd-4005-9c11-2d6f2d8bd0eb-overlay" anchor="action-bar-09931a7c-fbfd-4005-9c11-2d6f2d8bd0eb-button" align="end" side="outside-bottom" anchor-offset="normal" popover="auto" data-view-component="true">
  <div data-view-component="true" class="Overlay Overlay--size-auto">
    
      <div data-view-component="true" class="Overlay-body Overlay-body--paddingNone">          <action-list>
  <div data-view-component="true">
    <ul aria-labelledby="action-bar-09931a7c-fbfd-4005-9c11-2d6f2d8bd0eb-button" id="action-bar-09931a7c-fbfd-4005-9c11-2d6f2d8bd0eb-list" role="menu" data-view-component="true" class="ActionListWrap--inset ActionListWrap">
        <li value="" hidden="hidden" data-for="action-bar-0c16672f-4331-4018-8906-337d440c6121" data-action="click:action-bar#menuItemClick" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <button tabindex="-1" id="item-c809a6a4-60c0-4e2f-9000-52db63254140" type="button" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-heading">
    <path d="M3.75 2a.75.75 0 0 1 .75.75V7h7V2.75a.75.75 0 0 1 1.5 0v10.5a.75.75 0 0 1-1.5 0V8.5h-7v4.75a.75.75 0 0 1-1.5 0V2.75A.75.75 0 0 1 3.75 2Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Heading
</span></button>
  
  
</li>
        <li value="" hidden="hidden" data-for="action-bar-ab877954-950b-4725-9b8e-0f41dd42ee2e" data-action="click:action-bar#menuItemClick" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <button tabindex="-1" id="item-75686cb0-a00d-4338-88dc-5483028edf68" type="button" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-bold">
    <path d="M4 2h4.5a3.501 3.501 0 0 1 2.852 5.53A3.499 3.499 0 0 1 9.5 14H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm1 7v3h4.5a1.5 1.5 0 0 0 0-3Zm3.5-2a1.5 1.5 0 0 0 0-3H5v3Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Bold
</span></button>
  
  
</li>
        <li value="" hidden="hidden" data-for="action-bar-2bda957d-2650-4ff6-8ffa-9c77ae6a28fa" data-action="click:action-bar#menuItemClick" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <button tabindex="-1" id="item-ebeab3f8-adb3-4494-8f0b-a791afaae50e" type="button" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-italic">
    <path d="M6 2.75A.75.75 0 0 1 6.75 2h6.5a.75.75 0 0 1 0 1.5h-2.505l-3.858 9H9.25a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1 0-1.5h2.505l3.858-9H6.75A.75.75 0 0 1 6 2.75Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Italic
</span></button>
  
  
</li>
        <li value="" hidden="hidden" data-for="action-bar-f0e13c28-cd82-4bc1-b7d7-8fe002af3f85" data-action="click:action-bar#menuItemClick" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <button tabindex="-1" id="item-0bb9a3f9-099e-4703-9008-39c260bce1e4" type="button" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-quote">
    <path d="M1.75 2.5h10.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1 0-1.5Zm4 5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5Zm0 5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5ZM2.5 7.75v6a.75.75 0 0 1-1.5 0v-6a.75.75 0 0 1 1.5 0Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Quote
</span></button>
  
  
</li>
        <li value="" hidden="hidden" data-for="action-bar-ce96d6dd-9fcc-45d5-b0b8-cd23249f4853" data-action="click:action-bar#menuItemClick" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <button tabindex="-1" id="item-d48bfcbd-6bfa-4460-8682-137229377abd" type="button" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-code">
    <path d="m11.28 3.22 4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L13.94 8l-3.72-3.72a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215Zm-6.56 0a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L2.06 8l3.72 3.72a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L.47 8.53a.75.75 0 0 1 0-1.06Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Code
</span></button>
  
  
</li>
        <li value="" hidden="hidden" data-for="action-bar-9fe239c7-2b66-44d7-928b-d7726181effb" data-action="click:action-bar#menuItemClick" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <button tabindex="-1" id="item-01addccf-bc3c-4a48-a4e1-efcdc337b813" type="button" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-link">
    <path d="m7.775 3.275 1.25-1.25a3.5 3.5 0 1 1 4.95 4.95l-2.5 2.5a3.5 3.5 0 0 1-4.95 0 .751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018 1.998 1.998 0 0 0 2.83 0l2.5-2.5a2.002 2.002 0 0 0-2.83-2.83l-1.25 1.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042Zm-4.69 9.64a1.998 1.998 0 0 0 2.83 0l1.25-1.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-1.25 1.25a3.5 3.5 0 1 1-4.95-4.95l2.5-2.5a3.5 3.5 0 0 1 4.95 0 .751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018 1.998 1.998 0 0 0-2.83 0l-2.5 2.5a1.998 1.998 0 0 0 0 2.83Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Link
</span></button>
  
  
</li>
        <li hidden="hidden" role="presentation" aria-hidden="true" data-view-component="true" class="ActionList-sectionDivider"></li>
        <li value="" hidden="hidden" data-for="action-bar-04484f9b-92d8-4b16-acbf-744fdacfd043" data-action="click:action-bar#menuItemClick" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <button tabindex="-1" id="item-44fe04f8-2f5e-4819-9123-4988f252d0e8" type="button" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-list-ordered">
    <path d="M5 3.25a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 5 3.25Zm0 5a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 5 8.25Zm0 5a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1-.75-.75ZM.924 10.32a.5.5 0 0 1-.851-.525l.001-.001.001-.002.002-.004.007-.011c.097-.144.215-.273.348-.384.228-.19.588-.392 1.068-.392.468 0 .858.181 1.126.484.259.294.377.673.377 1.038 0 .987-.686 1.495-1.156 1.845l-.047.035c-.303.225-.522.4-.654.597h1.357a.5.5 0 0 1 0 1H.5a.5.5 0 0 1-.5-.5c0-1.005.692-1.52 1.167-1.875l.035-.025c.531-.396.8-.625.8-1.078a.57.57 0 0 0-.128-.376C1.806 10.068 1.695 10 1.5 10a.658.658 0 0 0-.429.163.835.835 0 0 0-.144.153ZM2.003 2.5V6h.503a.5.5 0 0 1 0 1H.5a.5.5 0 0 1 0-1h.503V3.308l-.28.14a.5.5 0 0 1-.446-.895l1.003-.5a.5.5 0 0 1 .723.447Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Numbered list
</span></button>
  
  
</li>
        <li value="" hidden="hidden" data-for="action-bar-c31b2839-4335-4fbc-b734-1428f1b969d7" data-action="click:action-bar#menuItemClick" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <button tabindex="-1" id="item-fea42ccb-190e-444c-b9e6-038548613c1f" type="button" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-list-unordered">
    <path d="M5.75 2.5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5Zm0 5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5Zm0 5h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1 0-1.5ZM2 14a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm1-6a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM2 4a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Unordered list
</span></button>
  
  
</li>
        <li value="" hidden="hidden" data-for="action-bar-d8b60157-23c9-4e4e-b1df-8e74a83929f3" data-action="click:action-bar#menuItemClick" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <button tabindex="-1" id="item-93c339c3-6798-4e02-8593-f8a9b2cc6377" type="button" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-tasklist">
    <path d="M2 2h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm4.655 8.595a.75.75 0 0 1 0 1.06L4.03 14.28a.75.75 0 0 1-1.06 0l-1.5-1.5a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215l.97.97 2.095-2.095a.75.75 0 0 1 1.06 0ZM9.75 2.5h5.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1 0-1.5Zm0 5h5.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1 0-1.5Zm0 5h5.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1 0-1.5Zm-7.25-9v3h3v-3Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Task list
</span></button>
  
  
</li>
        <li hidden="hidden" role="presentation" aria-hidden="true" data-view-component="true" class="ActionList-sectionDivider"></li>
        <li value="" hidden="hidden" data-for="action-bar-6e1cb5f2-b65c-4ce9-8c3a-39c6851cec95" data-action="click:action-bar#menuItemClick" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <button tabindex="-1" id="item-a5212683-8242-4e64-8ce8-8b168b9c5c94" type="button" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-paperclip">
    <path d="M12.212 3.02a1.753 1.753 0 0 0-2.478.003l-5.83 5.83a3.007 3.007 0 0 0-.88 2.127c0 .795.315 1.551.88 2.116.567.567 1.333.89 2.126.89.79 0 1.548-.321 2.116-.89l5.48-5.48a.75.75 0 0 1 1.061 1.06l-5.48 5.48a4.492 4.492 0 0 1-3.177 1.33c-1.2 0-2.345-.487-3.187-1.33a4.483 4.483 0 0 1-1.32-3.177c0-1.195.475-2.341 1.32-3.186l5.83-5.83a3.25 3.25 0 0 1 5.553 2.297c0 .863-.343 1.691-.953 2.301L7.439 12.39c-.375.377-.884.59-1.416.593a1.998 1.998 0 0 1-1.412-.593 1.992 1.992 0 0 1 0-2.828l5.48-5.48a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-5.48 5.48a.492.492 0 0 0 0 .707.499.499 0 0 0 .352.154.51.51 0 0 0 .356-.154l5.833-5.827a1.755 1.755 0 0 0 0-2.481Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Attach files
</span></button>
  
  
</li>
        <li value="" hidden="hidden" data-for="action-bar-371fc0bb-c80a-4cbe-afcd-9ce4d530f69f" data-action="click:action-bar#menuItemClick" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <button tabindex="-1" id="item-7e9e9e52-2dd8-4e2b-a0b7-cd1f107a65ea" type="button" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-mention">
    <path d="M4.75 2.37a6.501 6.501 0 0 0 6.5 11.26.75.75 0 0 1 .75 1.298A7.999 7.999 0 0 1 .989 4.148 8 8 0 0 1 16 7.75v1.5a2.75 2.75 0 0 1-5.072 1.475 3.999 3.999 0 0 1-6.65-4.19A4 4 0 0 1 12 8v1.25a1.25 1.25 0 0 0 2.5 0V7.867a6.5 6.5 0 0 0-9.75-5.496ZM10.5 8a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Mention
</span></button>
  
  
</li>
        <li value="" hidden="hidden" data-for="action-bar-9ee02cac-b207-4807-8514-877d7cb4855c" data-action="click:action-bar#menuItemClick" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <button tabindex="-1" id="item-8f99ff71-78b3-4e3d-bee3-983924b931ae" type="button" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-cross-reference">
    <path d="M2.75 3.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h4.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 13H9.06l-2.573 2.573A1.458 1.458 0 0 1 4 14.543V13H2.75A1.75 1.75 0 0 1 1 11.25v-7.5C1 2.784 1.784 2 2.75 2h5.5a.75.75 0 0 1 0 1.5ZM16 1.25v4.146a.25.25 0 0 1-.427.177L14.03 4.03l-3.75 3.75a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l3.75-3.75-1.543-1.543A.25.25 0 0 1 11.604 1h4.146a.25.25 0 0 1 .25.25Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Reference
</span></button>
  
  
</li>
        <li value="" hidden="hidden" data-for="action-bar-968a5f6e-838d-4a39-b5c9-00dba61c3edc" data-action="click:action-bar#menuItemClick" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <button tabindex="-1" id="item-0d769b85-ec27-4a0b-a8e9-c9951e222283" type="button" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-reply">
    <path d="M6.78 1.97a.75.75 0 0 1 0 1.06L3.81 6h6.44A4.75 4.75 0 0 1 15 10.75v2.5a.75.75 0 0 1-1.5 0v-2.5a3.25 3.25 0 0 0-3.25-3.25H3.81l2.97 2.97a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L1.47 7.28a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Saved replies
</span></button>
  
  
</li>
        <li value="" hidden="hidden" data-for="action-bar-9442f0f2-19e3-4b3f-baa5-dcae647b437b" data-action="click:action-bar#menuItemClick" data-targets="action-list.items" role="none" data-view-component="true" class="ActionListItem">
    
    <button tabindex="-1" id="item-ef72fd01-10c1-426d-8453-73b6a8f88765" type="button" role="menuitem" data-view-component="true" class="ActionListContent ActionListContent--visual16">
        <span class="ActionListItem-visual ActionListItem-visual--leading">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-diff-ignored">
    <path d="M13.25 1c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 13.25 15H2.75A1.75 1.75 0 0 1 1 13.25V2.75C1 1.784 1.784 1 2.75 1ZM2.75 2.5a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25V2.75a.25.25 0 0 0-.25-.25Zm8.53 3.28-5.5 5.5a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l5.5-5.5a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z"></path>
</svg>
        </span>
      
        <span data-view-component="true" class="ActionListItem-label">
          Slash commands
</span></button>
  
  
</li>
</ul>    
</div></action-list>


</div>
      
</div></anchored-position>  </focus-group>
</action-menu></action-bar></markdown-toolbar>

<dialog-helper>
  <dialog id="saved_replies_menu_new_comment_field-dialog" aria-modal="true" aria-labelledby="saved_replies_menu_new_comment_field-dialog-title" aria-describedby="saved_replies_menu_new_comment_field-dialog-description" data-view-component="true" class="Overlay Overlay-whenNarrow Overlay--size-medium Overlay--motion-scaleFade Overlay--placement-bottom-whenNarrow js-saved-reply-container">
    <div data-view-component="true" class="Overlay-header">
  <div class="Overlay-headerContentWrap">
    <div class="Overlay-titleWrap">
      <h1 class="Overlay-title " id="saved_replies_menu_new_comment_field-dialog-title">
        Select a reply
      </h1>
    </div>
    <div class="Overlay-actionWrap">
      <button data-close-dialog-id="saved_replies_menu_new_comment_field-dialog" aria-label="Close" type="button" data-view-component="true" class="close-button Overlay-closeButton"><svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-x">
    <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path>
</svg></button>
    </div>
  </div>
</div>
      <scrollable-region data-labelled-by="saved_replies_menu_new_comment_field-dialog-title">
        <div data-view-component="true" class="Overlay-body">    <include-fragment class="js-saved-reply-include-fragment" role="menuitem" aria-label="Loading" src="/settings/replies?context=issue" loading="lazy">
      <svg style="box-sizing: content-box; color: var(--color-icon-primary);" width="32" height="32" viewBox="0 0 16 16" fill="none" data-view-component="true" class="my-6 mx-auto d-block anim-rotate">
  <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-opacity="0.25" stroke-width="2" vector-effect="non-scaling-stroke" fill="none" />
  <path d="M15 8a7.002 7.002 0 00-7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke" />
</svg>
    </include-fragment>
</div>
      </scrollable-region>
      <div data-view-component="true" class="Overlay-footer Overlay-footer--alignEnd Overlay-footer--divided">    <a href="/settings/replies?return_to=1" data-view-component="true" class="Button--invisible Button--medium Button Button--fullWidth">  <span class="Button-content Button-content--alignStart">
      <span class="Button-visual Button-leadingVisual">
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-plus">
    <path d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z"></path>
</svg>
      </span>
    <span class="Button-label">Create a new saved reply</span>
  </span>
</a>
</div>
</dialog></dialog-helper>


  </div>

  <div class="comment-form-error js-comment-form-error" role="alert" hidden>
    There was an error creating your Issue.
  </div>

  <file-attachment class="js-upload-markdown-image is-default" input="fc-new_comment_field" role="tabpanel" aria-labelledby="write_tab_previewable-comment-form-component-c483ee56-f067-471c-bcc3-b2d0def6eab4" data-tab-container-no-tabstop="true" data-upload-repository-id="148233297" data-upload-policy-url="/upload/policies/assets"><input type="hidden" value="2bIYOTn2TebRqc7DSh5G1stGV4ftgiRGBAkvANYgOTDv4OEP6UIXvXZ6HfFKCxioPnurBzXdkHdsZsaZYxAInA" data-csrf="true" class="js-data-upload-policy-url-csrf" />
    <div class="js-write-bucket position-relative">
        <input
          type="hidden"
          name="saved_reply_id"
          id="new_comment_field_saved_reply_id"
          class="js-resettable-field"
          value=""
          data-reset-value=""
        >

      <text-expander
        keys=": @ #"
          data-issue-url="/suggestions/issue/2254985370?issue_suggester=1&amp;repository=test-repository&amp;user_id=HiromiShikata"
          data-mention-url="/suggestions/issue/2254985370?mention_suggester=1&amp;repository=test-repository&amp;user_id=HiromiShikata"
          multiword="#"
        data-emoji-url="/autocomplete/emoji"
      >
          <slash-command-expander
    keys="/"
    data-slash-command-url="/HiromiShikata/test-repository/slash_apps?subject_gid=I_kwDOCNXcUc6GaFia&amp;surface=issue_comment"
  >
    <div class="SelectMenu js-slash-command-expander-loading d-none">
      <div class="SelectMenu-modal">
        <header class="SelectMenu-header">
          <div class="flex-1">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-code-square">
    <path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25Zm7.47 3.97a.75.75 0 0 1 1.06 0l2 2a.75.75 0 0 1 0 1.06l-2 2a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L10.69 8 9.22 6.53a.75.75 0 0 1 0-1.06ZM6.78 6.53 5.31 8l1.47 1.47a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215l-2-2a.75.75 0 0 1 0-1.06l2-2a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z"></path>
</svg>

    <span class="color-fg-muted text-small pl-1" >Slash commands</span>
</div>

<div data-view-component="true" class="Label Label--success">Beta</div>
<a class="ml-1 color-fg-muted d-block" target="_blank" rel="noopener noreferrer" href="/feedback/slash-commands">
  Give feedback
</a>

        </header>
        <div class="SelectMenu-loading">
          <svg style="box-sizing: content-box; color: var(--color-icon-primary);" width="32" height="32" viewBox="0 0 16 16" fill="none" data-view-component="true" class="mx-auto d-block anim-rotate">
  <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-opacity="0.25" stroke-width="2" vector-effect="non-scaling-stroke" fill="none" />
  <path d="M15 8a7.002 7.002 0 00-7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke" />
</svg>
        </div>
      </div>
    </div>

    <div class="SelectMenu js-slash-command-expander-error d-none">
      <div class="SelectMenu-modal">
        <header class="SelectMenu-header">
          <div class="flex-1">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-code-square">
    <path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25Zm7.47 3.97a.75.75 0 0 1 1.06 0l2 2a.75.75 0 0 1 0 1.06l-2 2a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L10.69 8 9.22 6.53a.75.75 0 0 1 0-1.06ZM6.78 6.53 5.31 8l1.47 1.47a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215l-2-2a.75.75 0 0 1 0-1.06l2-2a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z"></path>
</svg>

    <span class="color-fg-muted text-small pl-1" >Slash commands</span>
</div>

<div data-view-component="true" class="Label Label--success">Beta</div>
<a class="ml-1 color-fg-muted d-block" target="_blank" rel="noopener noreferrer" href="/feedback/slash-commands">
  Give feedback
</a>

        </header>
        <div class="SelectMenu-list">
          <div class="SelectMenu-blankslate">
            <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-alert color-fg-muted">
    <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"></path>
</svg>
            <h4 class="my-2">An unexpected error has occurred</h4>
          </div>
        </div>
      </div>
    </div>

    
        <div class="CommentBox-container">
          <textarea name="comment[body]"
                    id="new_comment_field"
                    
                    placeholder=" "
                    data-required-trimmed="Text field is empty"
                    class="js-comment-field js-paste-markdown js-task-list-field js-quick-submit FormControl-textarea CommentBox-input js-size-to-fit js-session-resumable js-saved-reply-shortcut-comment-field"
                    dir="auto"
                      aria-describedby="placeholder_previewable-comment-form-component-c483ee56-f067-471c-bcc3-b2d0def6eab4"
                    
                    required></textarea>
          <p class="CommentBox-placeholder" id="placeholder_previewable-comment-form-component-c483ee56-f067-471c-bcc3-b2d0def6eab4" data-comment-box-placeholder aria-hidden="true">
            Add your comment here...
          </p>
        </div>

  </slash-command-expander>
      </text-expander>
        <input accept=".gif,.jpeg,.jpg,.mov,.mp4,.png,.svg,.webm,.cpuprofile,.csv,.dmp,.docx,.fodg,.fodp,.fods,.fodt,.gz,.json,.jsonc,.log,.md,.odf,.odg,.odp,.ods,.odt,.patch,.pdf,.pptx,.tgz,.txt,.xls,.xlsx,.zip" type="file" multiple hidden id="fc-new_comment_field">
        <div class="file-attachment-errors">
          <x-banner data-dismiss-scheme="none" data-view-component="true">
  <div data-view-component="true" class="rounded-bottom-2 bad-file repository-required Banner flash Banner--error flash-error Banner--full flash-full border-bottom-0">
      <div class="Banner-visual">
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-stop">
    <path d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path>
</svg>
      </div>
    <div data-view-component="true" class="Banner-message">
      <p class="Banner-title" data-target="x-banner.titleText">We don’t support that file type.</p>
        <p>Try again with GIF, JPEG, JPG, MOV, MP4, PNG, SVG, WEBM, CPUPROFILE, CSV, DMP, DOCX, FODG, FODP, FODS, FODT, GZ, JSON, JSONC, LOG, MD, ODF, ODG, ODP, ODS, ODT, PATCH, PDF, PPTX, TGZ, TXT, XLS, XLSX or ZIP.</p>
</div></div></x-banner>
          <x-banner data-dismiss-scheme="none" data-view-component="true">
  <div data-view-component="true" class="rounded-bottom-2 bad-permissions Banner flash Banner--error flash-error Banner--full flash-full border-bottom-0">
      <div class="Banner-visual">
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-stop">
    <path d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path>
</svg>
      </div>
    <div data-view-component="true" class="Banner-message">
      <p class="Banner-title" data-target="x-banner.titleText">Attaching documents requires write permission to this repository.</p>
        <p>Try again with GIF, JPEG, JPG, MOV, MP4, PNG, SVG, WEBM, CPUPROFILE, CSV, DMP, DOCX, FODG, FODP, FODS, FODT, GZ, JSON, JSONC, LOG, MD, ODF, ODG, ODP, ODS, ODT, PATCH, PDF, PPTX, TGZ, TXT, XLS, XLSX or ZIP.</p>
</div></div></x-banner>
          <x-banner data-dismiss-scheme="none" data-view-component="true">
  <div data-view-component="true" class="rounded-bottom-2 too-big js-upload-too-big Banner flash Banner--error flash-error Banner--full flash-full border-bottom-0">
      <div class="Banner-visual">
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-stop">
    <path d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path>
</svg>
      </div>
    <div data-view-component="true" class="Banner-message">
      <p class="Banner-title" data-target="x-banner.titleText"></p>
</div></div></x-banner>
          <x-banner data-dismiss-scheme="none" data-view-component="true">
  <div data-view-component="true" class="rounded-bottom-2 empty Banner flash Banner--error flash-error Banner--full flash-full border-bottom-0">
      <div class="Banner-visual">
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-stop">
    <path d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path>
</svg>
      </div>
    <div data-view-component="true" class="Banner-message">
      <p class="Banner-title" data-target="x-banner.titleText">This file is empty.</p>
        <p>Try again with a file that’s not empty.</p>
</div></div></x-banner>
          <x-banner data-dismiss-scheme="none" data-view-component="true">
  <div data-view-component="true" class="rounded-bottom-2 hidden-file Banner flash Banner--error flash-error Banner--full flash-full border-bottom-0">
      <div class="Banner-visual">
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-stop">
    <path d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path>
</svg>
      </div>
    <div data-view-component="true" class="Banner-message">
      <p class="Banner-title" data-target="x-banner.titleText">This file is hidden.</p>
        <p>Try again with another file.</p>
</div></div></x-banner>
          <x-banner data-dismiss-scheme="none" data-view-component="true">
  <div data-view-component="true" class="rounded-bottom-2 failed-request Banner flash Banner--error flash-error Banner--full flash-full border-bottom-0">
      <div class="Banner-visual">
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-stop">
    <path d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path>
</svg>
      </div>
    <div data-view-component="true" class="Banner-message">
      <p class="Banner-title" data-target="x-banner.titleText">Something went really wrong, and we can’t process that file.</p>
        <p>Try again.</p>
</div></div></x-banner>
        </div>
    </div>

    <div class="pr-2 pl-2 pb-2">
      <div data-view-component="true" class="border-right color-border-muted d-inline-block mr-1 pr-2">
        <a href="https://docs.github.com/github/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax" target="_blank" rel="noopener noreferrer" data-ga-click="Markdown Toolbar, click, help" data-analytics-event="{&quot;category&quot;:&quot;comment_box&quot;,&quot;action&quot;:&quot;MARKDOWN_BUTTON&quot;,&quot;label&quot;:null}" data-view-component="true" class="Button--invisible Button--small Button">  <span class="Button-content">
      <span class="Button-visual Button-leadingVisual">
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-markdown">
    <path d="M14.85 3c.63 0 1.15.52 1.14 1.15v7.7c0 .63-.51 1.15-1.15 1.15H1.15C.52 13 0 12.48 0 11.84V4.15C0 3.52.52 3 1.15 3ZM9 11V5H7L5.5 7 4 5H2v6h2V8l1.5 1.92L7 8v3Zm2.99.5L14.5 8H13V5h-2v3H9.5Z"></path>
</svg>
      </span>
    <span class="Button-label">Markdown is supported</span>
  </span>
</a>
</div>        <button data-file-attachment-for="fc-new_comment_field" data-analytics-event="{&quot;category&quot;:&quot;comment_box&quot;,&quot;action&quot;:&quot;UPLOAD_BUTTON&quot;,&quot;label&quot;:null}" type="button" data-view-component="true" class="Button--invisible Button--small Button">  <span class="Button-content">
      <span class="Button-visual Button-leadingVisual">
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-image">
    <path d="M16 13.25A1.75 1.75 0 0 1 14.25 15H1.75A1.75 1.75 0 0 1 0 13.25V2.75C0 1.784.784 1 1.75 1h12.5c.966 0 1.75.784 1.75 1.75ZM1.75 2.5a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h.94l.03-.03 6.077-6.078a1.75 1.75 0 0 1 2.412-.06L14.5 10.31V2.75a.25.25 0 0 0-.25-.25Zm12.5 11a.25.25 0 0 0 .25-.25v-.917l-4.298-3.889a.25.25 0 0 0-.344.009L4.81 13.5ZM7 6a2 2 0 1 1-3.999.001A2 2 0 0 1 7 6ZM5.5 6a.5.5 0 1 0-1 0 .5.5 0 0 0 1 0Z"></path>
</svg>
      </span>
    <span class="Button-label">Paste, drop, or click to add files</span>
  </span>
</button>
    </div>
</file-attachment>
  <div
    role="tabpanel"
    class="js-preview-panel overflow-auto CommentBox-comment"
    aria-labelledby="preview_tab_previewable-comment-form-component-c483ee56-f067-471c-bcc3-b2d0def6eab4"
    hidden
  >
    <input type="hidden" name="path" value="" class="js-path">
    <input type="hidden" name="line" value="" class="js-line-number">
    <input type="hidden" name="start_line" value="" class="js-start-line-number">
    <input type="hidden" name="preview_side" value="" class="js-side">
    <input type="hidden" name="preview_start_side" value="" class="js-start-side">
    <input type="hidden" name="start_commit_oid" value="" class="js-start-commit-oid">
    <input type="hidden" name="end_commit_oid" value="" class="js-end-commit-oid">
    <input type="hidden" name="base_commit_oid" value="" class="js-base-commit-oid">
    <input type="hidden" name="comment_id" value="" class="js-comment-id">
    <div class="comment js-suggested-changes-container" data-thread-side="">
  <div class="comment-body markdown-body js-preview-body" >
    <p>Nothing to preview</p>
  </div>
</div>

  </div>

  <div class="comment-form-error mb-2 js-comment-update-error" hidden></div>
</tab-container>
          </fieldset>
          <div class="mt-2">
              <div id="partial-new-comment-form-actions"
    class="js-socket-channel js-updatable-content d-flex flex-justify-end flex-items-center flex-wrap gap-2"
    data-channel="eyJjIjoiaXNzdWU6MjI1NDk4NTM3MDpzdGF0ZSIsInQiOjE3MTM2OTY0MTZ9--85dd4356131528b670c1eef872ea7a390ccf49851df5f1d7041d5aa61cc60aed"
      data-url="/HiromiShikata/test-repository/issues/38/show_partial?partial=issues%2Fform_actions"
  >

  <div class="d-flex flex-items-center">
  </div>

  <div class="flex-auto"></div>

    <div class="d-flex flex-justify-end">
      <div class="color-bg-subtle">
                <close-reason-selector>
  <div class="BtnGroup d-flex width-full" >
      <button name="comment_and_close" value="1" data-disable-with="" data-comment-text="Close with comment" formnovalidate="formnovalidate" type="submit" data-view-component="true" class="js-comment-and-button js-quick-submit-alternative btn BtnGroup-item flex-1">    <div class="mr-1 d-inline-block" data-target="close-reason-selector.selectedIconContainer">
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-issue-closed color-fg-done">
    <path d="M11.28 6.78a.75.75 0 0 0-1.06-1.06L7.25 8.69 5.78 7.22a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l3.5-3.5Z"></path><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0Zm-1.5 0a6.5 6.5 0 1 0-13 0 6.5 6.5 0 0 0 13 0Z"></path>
</svg>
      </div>
      <span class="js-form-action-text" data-default-action-text="Close issue">
        Close issue
      </span>
</button>    <details class="details-reset details-overlay select-menu BtnGroup-parent position-relative">
        <summary data-disable-invalid="" data-disable-with="" aria-label="Select close issue reason" data-view-component="true" class="select-menu-button btn BtnGroup-item float-none">
</summary>
      <details-menu
        class="select-menu-modal position-absolute right-0"
        style="z-index: 99"
        data-action="details-menu-selected:close-reason-selector#handleSelection"
      >
        <div class="select-menu-list" role="menu">
            <label
              class="select-menu-item"
              tabindex="0"
              role="menuitemradio"
              aria-checked="true"
              
            >
              <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-check select-menu-item-icon">
    <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path>
</svg>
              <input type="radio" name="state_reason" id="state_reason_completed" value="completed" checked="checked" />
              <div class="select-menu-item-text">
                <div class="select-menu-item-heading d-flex flex-items-center">
                  <div class="d-flex flex-items-center mr-1" data-close-reason-icon>
                    <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-issue-closed color-fg-done">
    <path d="M11.28 6.78a.75.75 0 0 0-1.06-1.06L7.25 8.69 5.78 7.22a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l3.5-3.5Z"></path><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0Zm-1.5 0a6.5 6.5 0 1 0-13 0 6.5 6.5 0 0 0 13 0Z"></path>
</svg>
                  </div>
                  Close as completed
                </div>
                <span class="description text-normal">Done, closed, fixed, resolved</span>
              </div>
            </label>
            <label
              class="select-menu-item"
              tabindex="0"
              role="menuitemradio"
              aria-checked="false"
              
            >
              <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-check select-menu-item-icon">
    <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path>
</svg>
              <input type="radio" name="state_reason" id="state_reason_not_planned" value="not_planned" />
              <div class="select-menu-item-text">
                <div class="select-menu-item-heading d-flex flex-items-center">
                  <div class="d-flex flex-items-center mr-1" data-close-reason-icon>
                    <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-skip color-fg-muted">
    <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm9.78-2.22-5.5 5.5a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l5.5-5.5a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z"></path>
</svg>
                  </div>
                  Close as not planned
                </div>
                <span class="description text-normal">Won&#39;t fix, can&#39;t repro, duplicate, stale</span>
              </div>
            </label>
        </div>
      </details-menu>
    </details>
  </div>
</close-reason-selector>


      </div>
      <div class="color-bg-subtle ml-1">
          <button data-disable-with="" data-disable-invalid="" type="submit" data-view-component="true" class="btn-primary btn">    Comment
</button>      </div>
    </div>
</div>

          </div>
</form>    </div>
        <div data-view-component="true" class="text-small color-fg-muted mt-3 mt-md-2 mb-2">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-info mr-1">
    <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path>
</svg>Remember, contributions to this repository should follow
    our
    <a style="text-decoration: underline" class="Link--inTextBlock" href="https://docs.github.com/articles/github-community-guidelines" >GitHub Community Guidelines</a>.
</div>

      <include-fragment src="/HiromiShikata/test-repository/sponsors-nudges"></include-fragment>

</div>


  </div>
</div>

</div>
  <div data-view-component="true" class="Layout-sidebar">                  <div id="partial-discussion-sidebar"
  class="js-socket-channel js-updatable-content"
  data-channel="eyJjIjoiaXNzdWU6MjI1NDk4NTM3MCIsInQiOjE3MTM2OTY0MTZ9--607be4872015f7956def485e4f24a9291857cbb6b2944964b7cdc4b0495a44e0"
  data-gid="I_kwDOCNXcUc6GaFia"
  data-url="/HiromiShikata/test-repository/issues/38/show_partial?partial=issues%2Fsidebar"
  data-project-hovercards-enabled>



    <div class="discussion-sidebar-item sidebar-assignee js-discussion-sidebar-item">
  <!-- '"\` --><!-- </textarea></xmp> --></option></form><form class="js-issue-sidebar-form" aria-label="Select assignees" data-turbo="false" action="/HiromiShikata/test-repository/issues/38/assignees" accept-charset="UTF-8" method="post"><input type="hidden" name="_method" value="put" autocomplete="off" /><input type="hidden" name="authenticity_token" value="4tQHi3ZfVLUstxVp21j2RSW68Cfe3Nen5EAv7xYkGpB9r5A6kTAT86qPOZWE6XA1S-bsmLFzBdaIodKaO3HpYg" />

      
  <details class="details-reset details-overlay select-menu hx_rsm "
    
    id="assignees-select-menu">

      <summary class="text-bold discussion-sidebar-heading discussion-sidebar-toggle hx_rsm-trigger"
              aria-haspopup="menu"
              data-hotkey="a"
              data-menu-trigger="assignees-select-menu">
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-gear">
    <path d="M8 0a8.2 8.2 0 0 1 .701.031C9.444.095 9.99.645 10.16 1.29l.288 1.107c.018.066.079.158.212.224.231.114.454.243.668.386.123.082.233.09.299.071l1.103-.303c.644-.176 1.392.021 1.82.63.27.385.506.792.704 1.218.315.675.111 1.422-.364 1.891l-.814.806c-.049.048-.098.147-.088.294.016.257.016.515 0 .772-.01.147.038.246.088.294l.814.806c.475.469.679 1.216.364 1.891a7.977 7.977 0 0 1-.704 1.217c-.428.61-1.176.807-1.82.63l-1.102-.302c-.067-.019-.177-.011-.3.071a5.909 5.909 0 0 1-.668.386c-.133.066-.194.158-.211.224l-.29 1.106c-.168.646-.715 1.196-1.458 1.26a8.006 8.006 0 0 1-1.402 0c-.743-.064-1.289-.614-1.458-1.26l-.289-1.106c-.018-.066-.079-.158-.212-.224a5.738 5.738 0 0 1-.668-.386c-.123-.082-.233-.09-.299-.071l-1.103.303c-.644.176-1.392-.021-1.82-.63a8.12 8.12 0 0 1-.704-1.218c-.315-.675-.111-1.422.363-1.891l.815-.806c.05-.048.098-.147.088-.294a6.214 6.214 0 0 1 0-.772c.01-.147-.038-.246-.088-.294l-.815-.806C.635 6.045.431 5.298.746 4.623a7.92 7.92 0 0 1 .704-1.217c.428-.61 1.176-.807 1.82-.63l1.102.302c.067.019.177.011.3-.071.214-.143.437-.272.668-.386.133-.066.194-.158.211-.224l.29-1.106C6.009.645 6.556.095 7.299.03 7.53.01 7.764 0 8 0Zm-.571 1.525c-.036.003-.108.036-.137.146l-.289 1.105c-.147.561-.549.967-.998 1.189-.173.086-.34.183-.5.29-.417.278-.97.423-1.529.27l-1.103-.303c-.109-.03-.175.016-.195.045-.22.312-.412.644-.573.99-.014.031-.021.11.059.19l.815.806c.411.406.562.957.53 1.456a4.709 4.709 0 0 0 0 .582c.032.499-.119 1.05-.53 1.456l-.815.806c-.081.08-.073.159-.059.19.162.346.353.677.573.989.02.03.085.076.195.046l1.102-.303c.56-.153 1.113-.008 1.53.27.161.107.328.204.501.29.447.222.85.629.997 1.189l.289 1.105c.029.109.101.143.137.146a6.6 6.6 0 0 0 1.142 0c.036-.003.108-.036.137-.146l.289-1.105c.147-.561.549-.967.998-1.189.173-.086.34-.183.5-.29.417-.278.97-.423 1.529-.27l1.103.303c.109.029.175-.016.195-.045.22-.313.411-.644.573-.99.014-.031.021-.11-.059-.19l-.815-.806c-.411-.406-.562-.957-.53-1.456a4.709 4.709 0 0 0 0-.582c-.032-.499.119-1.05.53-1.456l.815-.806c.081-.08.073-.159.059-.19a6.464 6.464 0 0 0-.573-.989c-.02-.03-.085-.076-.195-.046l-1.102.303c-.56.153-1.113.008-1.53-.27a4.44 4.44 0 0 0-.501-.29c-.447-.222-.85-.629-.997-1.189l-.289-1.105c-.029-.11-.101-.143-.137-.146a6.6 6.6 0 0 0-1.142 0ZM11 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM9.5 8a1.5 1.5 0 1 0-3.001.001A1.5 1.5 0 0 0 9.5 8Z"></path>
</svg>
        Assignees
      </summary>

    <details-menu
      class="js-discussion-sidebar-menu select-menu-modal position-absolute right-0 hx_rsm-modal"
      style="z-index: 99; overflow: visible;"
      data-multiple data-menu-max-options=10>
      <div class="select-menu-header rounded-top-2">
        <span class="select-menu-title">Assign up to 10 people to this issue</span>
        <button data-toggle-for="assignees-select-menu" aria-label="Close menu" type="button" data-view-component="true" class="close-button hx_rsm-close-button btn-link"><svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-x">
    <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path>
</svg></button>
      </div>
      

      <div class="hx_rsm-content" role="menu">
          <!-- when content is passed via block (ex: reviewers/assignees loads content via substring-memory in the block) -->
          
    
<div class="select-menu-filters">
  <div class="select-menu-text-filter hx_form-control-spinner-wrapper">
    <input
      type="text"
      id="assignee-filter-field"
      class="form-control js-filterable-field"
      placeholder="Type or choose a user"
      aria-label="Type or choose a user"
      autofocus spellcheck="false"
      autocomplete="off"
      >
      <svg style="box-sizing: content-box; color: var(--color-icon-primary);" width="16" height="16" viewBox="0 0 16 16" fill="none" data-view-component="true" class="hx_form-control-spinner anim-rotate">
  <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-opacity="0.25" stroke-width="2" vector-effect="non-scaling-stroke" fill="none" />
  <path d="M15 8a7.002 7.002 0 00-7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke" />
</svg>
  </div>
</div>

<div class="warning mb-0" hidden data-menu-max-options-warning>
  You can only select 10 assignees.
</div>

<div class="select-menu-list">
    <button class="btn-block select-menu-clear-item select-menu-item"
         role="menuitem"
         type="button" aria-label="Clear assignee" data-clear-assignees>
      <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-x select-menu-item-icon">
    <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path>
</svg>
      <div class="select-menu-item-text">Clear assignees</div>
    </button>
  <div class="select-menu-no-results">Nothing to show</div>

  <input type="hidden" value="" name="issue[user_assignee_ids][]">
  <div
    data-filterable-for="assignee-filter-field"
    data-filterable-type="substring-memory"
    data-filterable-limit="30"
    data-filterable-src="/HiromiShikata/test-repository/issues/38/show_partial?partial=issues%2Fsidebar%2Fassignees_menu_content"
    data-filterable-data-pre-rendered
    data-filterable-show-suggestion-header
    >

    <template>
      <label class="select-menu-item text-normal"
        role="menuitemcheckbox"
        aria-checked="false"
        tabindex="0">
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-check select-menu-item-icon">
    <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path>
</svg>

        <input style="display:none"
               type="checkbox"
               value=""
               name="issue[user_assignee_ids][]">

        <div class="select-menu-item-gravatar">
          <img src="" alt="" size="20" class="avatar-small mr-1 js-avatar">
        </div>

        <div class="select-menu-item-text lh-condensed">
          <span class="select-menu-item-heading">
            <span class="js-username"></span>
            <span class="description js-description"></span>
          </span>
        </div>
      </label>
    </template>

        <label class="select-menu-item text-normal js-filterable-suggested-user"
  role="menuitemcheckbox"
  aria-checked="true"
  tabindex="0">
  <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-check select-menu-item-icon">
    <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path>
</svg>

  <input style="display:none"
    type="checkbox"
    value="6440811"
    name="issue[user_assignee_ids][]"
    checked>

  <div class="select-menu-item-gravatar">
    <img class="avatar-small mr-1 js-avatar avatar-user" src="https://avatars.githubusercontent.com/u/6440811?s=40&amp;v=4" width="20" height="20" alt="@HiromiShikata" />
  </div>

  <div class="select-menu-item-text lh-condensed">
    <span class="select-menu-item-heading">
      <span class="js-username">HiromiShikata</span>
      <span class="description js-description">Hiromi.s</span>
    </span>
  </div>
</label>


      <svg style="box-sizing: content-box; color: var(--color-icon-primary);" width="32" height="32" viewBox="0 0 16 16" fill="none" data-view-component="true" class="my-5 mx-auto d-block anim-rotate">
  <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-opacity="0.25" stroke-width="2" vector-effect="non-scaling-stroke" fill="none" />
  <path d="M15 8a7.002 7.002 0 00-7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke" />
</svg>
        <div class="select-menu-divider js-divider-suggestions" hidden>Suggestions</div>
  </div>
</div>


      </div>

    </details-menu>
  </details>


        
<span class="css-truncate js-issue-assignees">
      <p>
        
<span class="d-flex min-width-0 flex-1 js-hovercard-left" data-hovercard-type="user" data-hovercard-url="/users/HiromiShikata/hovercard" data-assignee-name="HiromiShikata">
  <a class="no-underline" data-octo-click="hovercard-link-click" data-octo-dimensions="link_type:self" href="/HiromiShikata">
    <img class="avatar mr-1 avatar-user" src="https://avatars.githubusercontent.com/u/6440811?s=40&amp;v=4" width="20" height="20" alt="@HiromiShikata" />
</a>  <a class="assignee Link--primary css-truncate-target width-fit" data-octo-click="hovercard-link-click" data-octo-dimensions="link_type:self" href="/HiromiShikata">
    <span class="css-truncate-target width-fit v-align-middle">HiromiShikata</span>
</a>    <span class="reviewers-status-icon v-hidden" aria-hidden="true"></span>
</span>
      </p>
</span>


</form></div>


      
<div class="discussion-sidebar-item js-discussion-sidebar-item">
  


  <details class="details-reset details-overlay select-menu hx_rsm label-select-menu"
    
    id="labels-select-menu">

      <summary class="text-bold discussion-sidebar-heading discussion-sidebar-toggle hx_rsm-trigger"
              aria-haspopup="menu"
              data-hotkey="l"
              data-menu-trigger="labels-select-menu">
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-gear">
    <path d="M8 0a8.2 8.2 0 0 1 .701.031C9.444.095 9.99.645 10.16 1.29l.288 1.107c.018.066.079.158.212.224.231.114.454.243.668.386.123.082.233.09.299.071l1.103-.303c.644-.176 1.392.021 1.82.63.27.385.506.792.704 1.218.315.675.111 1.422-.364 1.891l-.814.806c-.049.048-.098.147-.088.294.016.257.016.515 0 .772-.01.147.038.246.088.294l.814.806c.475.469.679 1.216.364 1.891a7.977 7.977 0 0 1-.704 1.217c-.428.61-1.176.807-1.82.63l-1.102-.302c-.067-.019-.177-.011-.3.071a5.909 5.909 0 0 1-.668.386c-.133.066-.194.158-.211.224l-.29 1.106c-.168.646-.715 1.196-1.458 1.26a8.006 8.006 0 0 1-1.402 0c-.743-.064-1.289-.614-1.458-1.26l-.289-1.106c-.018-.066-.079-.158-.212-.224a5.738 5.738 0 0 1-.668-.386c-.123-.082-.233-.09-.299-.071l-1.103.303c-.644.176-1.392-.021-1.82-.63a8.12 8.12 0 0 1-.704-1.218c-.315-.675-.111-1.422.363-1.891l.815-.806c.05-.048.098-.147.088-.294a6.214 6.214 0 0 1 0-.772c.01-.147-.038-.246-.088-.294l-.815-.806C.635 6.045.431 5.298.746 4.623a7.92 7.92 0 0 1 .704-1.217c.428-.61 1.176-.807 1.82-.63l1.102.302c.067.019.177.011.3-.071.214-.143.437-.272.668-.386.133-.066.194-.158.211-.224l.29-1.106C6.009.645 6.556.095 7.299.03 7.53.01 7.764 0 8 0Zm-.571 1.525c-.036.003-.108.036-.137.146l-.289 1.105c-.147.561-.549.967-.998 1.189-.173.086-.34.183-.5.29-.417.278-.97.423-1.529.27l-1.103-.303c-.109-.03-.175.016-.195.045-.22.312-.412.644-.573.99-.014.031-.021.11.059.19l.815.806c.411.406.562.957.53 1.456a4.709 4.709 0 0 0 0 .582c.032.499-.119 1.05-.53 1.456l-.815.806c-.081.08-.073.159-.059.19.162.346.353.677.573.989.02.03.085.076.195.046l1.102-.303c.56-.153 1.113-.008 1.53.27.161.107.328.204.501.29.447.222.85.629.997 1.189l.289 1.105c.029.109.101.143.137.146a6.6 6.6 0 0 0 1.142 0c.036-.003.108-.036.137-.146l.289-1.105c.147-.561.549-.967.998-1.189.173-.086.34-.183.5-.29.417-.278.97-.423 1.529-.27l1.103.303c.109.029.175-.016.195-.045.22-.313.411-.644.573-.99.014-.031.021-.11-.059-.19l-.815-.806c-.411-.406-.562-.957-.53-1.456a4.709 4.709 0 0 0 0-.582c-.032-.499.119-1.05.53-1.456l.815-.806c.081-.08.073-.159.059-.19a6.464 6.464 0 0 0-.573-.989c-.02-.03-.085-.076-.195-.046l-1.102.303c-.56.153-1.113.008-1.53-.27a4.44 4.44 0 0 0-.501-.29c-.447-.222-.85-.629-.997-1.189l-.289-1.105c-.029-.11-.101-.143-.137-.146a6.6 6.6 0 0 0-1.142 0ZM11 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM9.5 8a1.5 1.5 0 1 0-3.001.001A1.5 1.5 0 0 0 9.5 8Z"></path>
</svg>
        Labels
      </summary>

    <details-menu
        src="/HiromiShikata/test-repository/issues/38/show_partial?partial=issues%2Fsidebar%2Flabels_menu_content"
        preload
      class="js-discussion-sidebar-menu select-menu-modal position-absolute right-0 hx_rsm-modal"
      style="z-index: 99; overflow: visible;"
      data-multiple>
      <div class="select-menu-header rounded-top-2">
        <span class="select-menu-title">Apply labels to this issue</span>
        <button data-toggle-for="labels-select-menu" aria-label="Close menu" type="button" data-view-component="true" class="close-button hx_rsm-close-button btn-link"><svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-x">
    <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path>
</svg></button>
      </div>
        <div class="select-menu-filters">
    <div class="select-menu-text-filter hx_form-control-spinner-wrapper">
      <input type="text" id="label-filter-field" class="form-control js-label-filter-field js-filterable-field"
             placeholder="Filter labels" aria-label="Filter labels" autocomplete="off" autofocus>
      <svg style="box-sizing: content-box; color: var(--color-icon-primary);" width="16" height="16" viewBox="0 0 16 16" fill="none" data-view-component="true" class="hx_form-control-spinner anim-rotate">
  <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-opacity="0.25" stroke-width="2" vector-effect="non-scaling-stroke" fill="none" />
  <path d="M15 8a7.002 7.002 0 00-7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke" />
</svg>
    </div>
  </div>


      <div class="hx_rsm-content" role="menu">
          <!-- when data is loaded as HTML via details-menu[src] -->
          <include-fragment>
            <svg style="box-sizing: content-box; color: var(--color-icon-primary);" width="32" height="32" viewBox="0 0 16 16" fill="none" data-view-component="true" class="my-6 mx-auto d-block anim-rotate">
  <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-opacity="0.25" stroke-width="2" vector-effect="non-scaling-stroke" fill="none" />
  <path d="M15 8a7.002 7.002 0 00-7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke" />
</svg>
            
          </include-fragment>
      </div>

    </details-menu>
  </details>


    <div class="js-issue-labels d-flex flex-wrap">
      
<a id="label-cf5a51" href="/HiromiShikata/test-repository/labels/enhancement" data-name="enhancement" style="--label-r:162;--label-g:238;--label-b:239;--label-h:180;--label-s:70;--label-l:78;" data-view-component="true" class="IssueLabel hx_IssueLabel width-fit mb-1 mr-1">
    <span class="css-truncate css-truncate-target width-fit">enhancement</span>
</a>
  <tool-tip id="tooltip-f3e9e5e4-cd59-41da-be90-cbe5c4b223e4" for="label-cf5a51" popover="manual" data-direction="s" data-type="description" data-view-component="true" class="sr-only position-absolute">New feature or request</tool-tip>

</div>

</div>


      

  <div class="discussion-sidebar-item js-discussion-sidebar-item">
    <!-- '"\` --><!-- </textarea></xmp> --></option></form><form class="js-issue-sidebar-form" aria-label="Select projects" data-turbo="false" action="/HiromiShikata/test-repository/projects/issues/38" accept-charset="UTF-8" method="post"><input type="hidden" name="_method" value="put" autocomplete="off" /><input type="hidden" name="authenticity_token" value="rjgxwdZ1-drnSOPIpGTcuOjJ0HZUJPCP0GFoW22X_uwi643nbm69jaYRRnLC9lQ2gYRBCNWlCddDWlXa2CqNnw" />
        <details class="details-reset details-overlay select-menu hx_rsm "
    
    id="projects-select-menu">

      <summary class="text-bold discussion-sidebar-heading discussion-sidebar-toggle hx_rsm-trigger"
              aria-haspopup="menu"
              data-hotkey="p"
              data-menu-trigger="projects-select-menu">
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-gear">
    <path d="M8 0a8.2 8.2 0 0 1 .701.031C9.444.095 9.99.645 10.16 1.29l.288 1.107c.018.066.079.158.212.224.231.114.454.243.668.386.123.082.233.09.299.071l1.103-.303c.644-.176 1.392.021 1.82.63.27.385.506.792.704 1.218.315.675.111 1.422-.364 1.891l-.814.806c-.049.048-.098.147-.088.294.016.257.016.515 0 .772-.01.147.038.246.088.294l.814.806c.475.469.679 1.216.364 1.891a7.977 7.977 0 0 1-.704 1.217c-.428.61-1.176.807-1.82.63l-1.102-.302c-.067-.019-.177-.011-.3.071a5.909 5.909 0 0 1-.668.386c-.133.066-.194.158-.211.224l-.29 1.106c-.168.646-.715 1.196-1.458 1.26a8.006 8.006 0 0 1-1.402 0c-.743-.064-1.289-.614-1.458-1.26l-.289-1.106c-.018-.066-.079-.158-.212-.224a5.738 5.738 0 0 1-.668-.386c-.123-.082-.233-.09-.299-.071l-1.103.303c-.644.176-1.392-.021-1.82-.63a8.12 8.12 0 0 1-.704-1.218c-.315-.675-.111-1.422.363-1.891l.815-.806c.05-.048.098-.147.088-.294a6.214 6.214 0 0 1 0-.772c.01-.147-.038-.246-.088-.294l-.815-.806C.635 6.045.431 5.298.746 4.623a7.92 7.92 0 0 1 .704-1.217c.428-.61 1.176-.807 1.82-.63l1.102.302c.067.019.177.011.3-.071.214-.143.437-.272.668-.386.133-.066.194-.158.211-.224l.29-1.106C6.009.645 6.556.095 7.299.03 7.53.01 7.764 0 8 0Zm-.571 1.525c-.036.003-.108.036-.137.146l-.289 1.105c-.147.561-.549.967-.998 1.189-.173.086-.34.183-.5.29-.417.278-.97.423-1.529.27l-1.103-.303c-.109-.03-.175.016-.195.045-.22.312-.412.644-.573.99-.014.031-.021.11.059.19l.815.806c.411.406.562.957.53 1.456a4.709 4.709 0 0 0 0 .582c.032.499-.119 1.05-.53 1.456l-.815.806c-.081.08-.073.159-.059.19.162.346.353.677.573.989.02.03.085.076.195.046l1.102-.303c.56-.153 1.113-.008 1.53.27.161.107.328.204.501.29.447.222.85.629.997 1.189l.289 1.105c.029.109.101.143.137.146a6.6 6.6 0 0 0 1.142 0c.036-.003.108-.036.137-.146l.289-1.105c.147-.561.549-.967.998-1.189.173-.086.34-.183.5-.29.417-.278.97-.423 1.529-.27l1.103.303c.109.029.175-.016.195-.045.22-.313.411-.644.573-.99.014-.031.021-.11-.059-.19l-.815-.806c-.411-.406-.562-.957-.53-1.456a4.709 4.709 0 0 0 0-.582c-.032-.499.119-1.05.53-1.456l.815-.806c.081-.08.073-.159.059-.19a6.464 6.464 0 0 0-.573-.989c-.02-.03-.085-.076-.195-.046l-1.102.303c-.56.153-1.113.008-1.53-.27a4.44 4.44 0 0 0-.501-.29c-.447-.222-.85-.629-.997-1.189l-.289-1.105c-.029-.11-.101-.143-.137-.146a6.6 6.6 0 0 0-1.142 0ZM11 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM9.5 8a1.5 1.5 0 1 0-3.001.001A1.5 1.5 0 0 0 9.5 8Z"></path>
</svg>
        Projects
      </summary>

    <details-menu
        src="/HiromiShikata/test-repository/issues/38/show_partial?partial=issues%2Fsidebar%2Fprojects_menu_content"
        preload
      class="js-discussion-sidebar-menu select-menu-modal position-absolute right-0 hx_rsm-modal"
      style="z-index: 99; overflow: visible;"
      data-multiple>
      <div class="select-menu-header rounded-top-2">
        <span class="select-menu-title">Projects</span>
        <button data-toggle-for="projects-select-menu" aria-label="Close menu" type="button" data-view-component="true" class="close-button hx_rsm-close-button btn-link"><svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-x">
    <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path>
</svg></button>
      </div>
      

      <div class="hx_rsm-content" role="menu">
          <!-- when data is loaded as HTML via details-menu[src] -->
          <include-fragment>
            <svg style="box-sizing: content-box; color: var(--color-icon-primary);" width="32" height="32" viewBox="0 0 16 16" fill="none" data-view-component="true" class="my-6 mx-auto d-block anim-rotate">
  <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-opacity="0.25" stroke-width="2" vector-effect="non-scaling-stroke" fill="none" />
  <path d="M15 8a7.002 7.002 0 00-7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke" />
</svg>
            
          </include-fragment>
      </div>

    </details-menu>
  </details>

        <div aria-live="polite">
</div>
<span class="css-truncate sidebar-progress-bar">
        <collapsible-sidebar-widget url="/memexes/1447941/items/60454075/edit_form">
  <div class="mb-2 border p-2 rounded-2 color-fg-muted">
    <div class="d-flex width-full flex-justify-between flex-items-center">
      <a class="css-truncate css-truncate-overflow f6 text-bold Link--primary no-underline mr-4" href="/users/HiromiShikata/projects/49">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-table">
    <path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25ZM6.5 6.5v8h7.75a.25.25 0 0 0 .25-.25V6.5Zm8-1.5V1.75a.25.25 0 0 0-.25-.25H6.5V5Zm-13 1.5v7.75c0 .138.112.25.25.25H5v-8ZM5 5V1.5H1.75a.25.25 0 0 0-.25.25V5Z"></path>
</svg>
        <span class="ml-1">V2 project on owner for testing</span>
</a>        <button type="button" tabindex="-1" aria-label="See more fields ..." class="collapsible-sidebar-widget-button" data-action="mousedown:collapsible-sidebar-widget#onMouseDown keydown:collapsible-sidebar-widget#onKeyDown" >
          <svg xmlns="http://www.w3.org/2000/svg" class="collapsible-sidebar-widget-indicator octicon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill-rule="evenodd" d="M12.78 6.22a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06 0L3.22 7.28a.75.75 0 011.06-1.06L8 9.94l3.72-3.72a.75.75 0 011.06 0z"></path></svg>
          <svg class="collapsible-sidebar-widget-loader anim-rotate" viewBox="0 0 16 16" fill="none" width="16" height="16" aria-hidden="true">
            <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-opacity="0.25" stroke-width="2" vector-effect="non-scaling-stroke"></circle>
            <path d="M15 8a7.002 7.002 0 00-7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke"></path>
          </svg>
        </button>
    </div>
    <div>
      <div class="d-flex flex-wrap flex-justify-between flex-items-center pt-2">
            <sidebar-memex-input
    update-url="/memexes/1447941/items"
    csrf-token="OSBaOqXjJ3Axs1qyuMNYLsTmjEUO6e2Km_QZsNqbwfPKUVHf7D0QUVoKRN3470N7BbpkvmO1Ds2YpyC-g0rtpw"
    column-id="60454075"
    instrument-type="sidebar"
  >

  <input data-targets="sidebar-memex-input.parameters" type="hidden" name="memexProjectItemId" value="60454075">
  <input data-targets="sidebar-memex-input.parameters" type="hidden" name="memexProjectColumnValues[][memexProjectColumnId]" value="13350727">

  <details id="select-menu-4b8287be-33c6-405b-8a41-cc081268f6a9" data-view-component="true" class="details-overlay details-reset position-relative border-0">
    <summary style="background: transparent; width: 100%" role="button" data-view-component="true" class="btn-sm btn border-0 rounded-0 box-shadow-none text-normal width-full py-0 px-0">    Status: <span data-menu-button="" data-view-component="true" class="css-truncate css-truncate-target">In Progress</span><svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-triangle-down ml-2 mr-n1">
    <path d="m4.427 7.427 3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 7H4.604a.25.25 0 0 0-.177.427Z"></path>
</svg>
</summary>

  <details-menu id="select-menu-4b8287be-33c6-405b-8a41-cc081268f6a9-content" role="menu" data-action="details-menu-select:sidebar-memex-input#handleDetailsSelect details-menu-selected:sidebar-memex-input#handleDetailsSelected" data-view-component="true" class="SelectMenu right-0">
    <div data-view-component="true" class="SelectMenu-modal">
      


      


          <div id="select-menu-4b8287be-33c6-405b-8a41-cc081268f6a9-list-1" data-view-component="true" class="SelectMenu-list">
  

    

    <div role="menu" data-filter-list>
        <button role="menuitemradio" aria-checked="false" type="button" data-view-component="true" class="SelectMenu-item border-0 pl-2 rounded-0 text-normal">
    <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-check SelectMenu-icon SelectMenu-icon--check">
    <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path>
</svg>
              <span data-menu-button-contents="" data-view-component="true" class="css-truncate css-truncate-overflow pl-2">Todo</span>
            <input type="hidden" data-targets="sidebar-memex-input.inputs" name="memexProjectColumnValues[][value]" value="f75ad846" placeholder="No status">

</button>

        <button role="menuitemradio" aria-checked="true" type="button" data-view-component="true" class="SelectMenu-item border-0 pl-2 rounded-0 text-normal">
    <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-check SelectMenu-icon SelectMenu-icon--check">
    <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path>
</svg>
              <span data-menu-button-contents="" data-view-component="true" class="css-truncate css-truncate-overflow pl-2">In Progress</span>
            <input type="hidden" data-targets="sidebar-memex-input.inputs" name="memexProjectColumnValues[][value]" value="47fc9ee4" placeholder="No status">

</button>

        <button role="menuitemradio" aria-checked="false" type="button" data-view-component="true" class="SelectMenu-item border-0 pl-2 rounded-0 text-normal">
    <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-check SelectMenu-icon SelectMenu-icon--check">
    <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path>
</svg>
              <span data-menu-button-contents="" data-view-component="true" class="css-truncate css-truncate-overflow pl-2">Done</span>
            <input type="hidden" data-targets="sidebar-memex-input.inputs" name="memexProjectColumnValues[][value]" value="98236657" placeholder="No status">

</button>


      <div data-filter-empty-state="true" hidden="hidden" data-view-component="true" class="SelectMenu-message">Nothing to show</div>
    </div>
</div>

      
</div></details-menu></details>
  </sidebar-memex-input>

              <button data-action="mousedown:collapsible-sidebar-widget#onMouseDown keydown:collapsible-sidebar-widget#onKeyDown" type="button" data-view-component="true" class="Link--primary btn-link">    +1 more
</button>
      </div>
    </div>
    <div class="collapsible-sidebar-widget-content" data-target="collapsible-sidebar-widget.collapsible"></div>
  </div>
</collapsible-sidebar-widget>


</span>

</form>  </div>


      <div class="discussion-sidebar-item sidebar-progress-bar js-discussion-sidebar-item">
  <!-- '"\` --><!-- </textarea></xmp> --></option></form><form class="js-issue-sidebar-form" aria-label="Select milestones" data-turbo="false" action="/HiromiShikata/test-repository/issues/38/set_milestone?partial=issues%2Fsidebar%2Fshow%2Fmilestone" accept-charset="UTF-8" method="post"><input type="hidden" name="_method" value="put" autocomplete="off" /><input type="hidden" name="authenticity_token" value="r_jPg-Qlwi-JVNpt8v90grDvlES-SQFwPd9f8HEcupyrkJQ5CIUcw5O7pqeJEr4C38PXzYRl2Ra8PUuhMDdfGQ" />
    
  <details class="details-reset details-overlay select-menu hx_rsm "
    
    id="milestone-select-menu">

      <summary class="text-bold discussion-sidebar-heading discussion-sidebar-toggle hx_rsm-trigger"
              aria-haspopup="menu"
              data-hotkey="m"
              data-menu-trigger="milestone-select-menu">
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-gear">
    <path d="M8 0a8.2 8.2 0 0 1 .701.031C9.444.095 9.99.645 10.16 1.29l.288 1.107c.018.066.079.158.212.224.231.114.454.243.668.386.123.082.233.09.299.071l1.103-.303c.644-.176 1.392.021 1.82.63.27.385.506.792.704 1.218.315.675.111 1.422-.364 1.891l-.814.806c-.049.048-.098.147-.088.294.016.257.016.515 0 .772-.01.147.038.246.088.294l.814.806c.475.469.679 1.216.364 1.891a7.977 7.977 0 0 1-.704 1.217c-.428.61-1.176.807-1.82.63l-1.102-.302c-.067-.019-.177-.011-.3.071a5.909 5.909 0 0 1-.668.386c-.133.066-.194.158-.211.224l-.29 1.106c-.168.646-.715 1.196-1.458 1.26a8.006 8.006 0 0 1-1.402 0c-.743-.064-1.289-.614-1.458-1.26l-.289-1.106c-.018-.066-.079-.158-.212-.224a5.738 5.738 0 0 1-.668-.386c-.123-.082-.233-.09-.299-.071l-1.103.303c-.644.176-1.392-.021-1.82-.63a8.12 8.12 0 0 1-.704-1.218c-.315-.675-.111-1.422.363-1.891l.815-.806c.05-.048.098-.147.088-.294a6.214 6.214 0 0 1 0-.772c.01-.147-.038-.246-.088-.294l-.815-.806C.635 6.045.431 5.298.746 4.623a7.92 7.92 0 0 1 .704-1.217c.428-.61 1.176-.807 1.82-.63l1.102.302c.067.019.177.011.3-.071.214-.143.437-.272.668-.386.133-.066.194-.158.211-.224l.29-1.106C6.009.645 6.556.095 7.299.03 7.53.01 7.764 0 8 0Zm-.571 1.525c-.036.003-.108.036-.137.146l-.289 1.105c-.147.561-.549.967-.998 1.189-.173.086-.34.183-.5.29-.417.278-.97.423-1.529.27l-1.103-.303c-.109-.03-.175.016-.195.045-.22.312-.412.644-.573.99-.014.031-.021.11.059.19l.815.806c.411.406.562.957.53 1.456a4.709 4.709 0 0 0 0 .582c.032.499-.119 1.05-.53 1.456l-.815.806c-.081.08-.073.159-.059.19.162.346.353.677.573.989.02.03.085.076.195.046l1.102-.303c.56-.153 1.113-.008 1.53.27.161.107.328.204.501.29.447.222.85.629.997 1.189l.289 1.105c.029.109.101.143.137.146a6.6 6.6 0 0 0 1.142 0c.036-.003.108-.036.137-.146l.289-1.105c.147-.561.549-.967.998-1.189.173-.086.34-.183.5-.29.417-.278.97-.423 1.529-.27l1.103.303c.109.029.175-.016.195-.045.22-.313.411-.644.573-.99.014-.031.021-.11-.059-.19l-.815-.806c-.411-.406-.562-.957-.53-1.456a4.709 4.709 0 0 0 0-.582c-.032-.499.119-1.05.53-1.456l.815-.806c.081-.08.073-.159.059-.19a6.464 6.464 0 0 0-.573-.989c-.02-.03-.085-.076-.195-.046l-1.102.303c-.56.153-1.113.008-1.53-.27a4.44 4.44 0 0 0-.501-.29c-.447-.222-.85-.629-.997-1.189l-.289-1.105c-.029-.11-.101-.143-.137-.146a6.6 6.6 0 0 0-1.142 0ZM11 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM9.5 8a1.5 1.5 0 1 0-3.001.001A1.5 1.5 0 0 0 9.5 8Z"></path>
</svg>
        Milestone
      </summary>

    <details-menu
        src="/HiromiShikata/test-repository/issues/38/show_partial?partial=issues%2Fsidebar%2Fmilestone_menu_content"
        preload
      class="js-discussion-sidebar-menu select-menu-modal position-absolute right-0 hx_rsm-modal"
      style="z-index: 99; overflow: visible;"
      >
      <div class="select-menu-header rounded-top-2">
        <span class="select-menu-title">Set milestone</span>
        <button data-toggle-for="milestone-select-menu" aria-label="Close menu" type="button" data-view-component="true" class="close-button hx_rsm-close-button btn-link"><svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-x">
    <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path>
</svg></button>
      </div>
      

      <div class="hx_rsm-content" role="menu">
          <!-- when data is loaded as HTML via details-menu[src] -->
          <include-fragment>
            <svg style="box-sizing: content-box; color: var(--color-icon-primary);" width="32" height="32" viewBox="0 0 16 16" fill="none" data-view-component="true" class="my-6 mx-auto d-block anim-rotate">
  <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-opacity="0.25" stroke-width="2" vector-effect="non-scaling-stroke" fill="none" />
  <path d="M15 8a7.002 7.002 0 00-7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke" />
</svg>
            
          </include-fragment>
      </div>

    </details-menu>
  </details>

      No milestone

</form></div>


    
      <create-branch
        data-default-repo="HiromiShikata/test-repository"
        data-selected-nwo="HiromiShikata/test-repository"
        data-default-source-branch="master"
        data-sidebar-url="/HiromiShikata/test-repository/issues/closing_references/partials/sidebar?source_id=2254985370&amp;source_type=ISSUE"
        class="discussion-sidebar-item d-block">
          
<div class="js-discussion-sidebar-item" data-target="create-branch.sidebarContainer">
  <div data-issue-and-pr-hovercards-enabled >
    <development-menu>
      <!-- '"\` --><!-- </textarea></xmp> --></option></form><form data-target="create-branch.developmentForm" data-turbo="false" class="js-issue-sidebar-form" aria-label="Link issues" action="/HiromiShikata/test-repository/issues/closing_references?source_id=2254985370&amp;source_type=ISSUE" accept-charset="UTF-8" method="post"><input type="hidden" name="_method" value="put" autocomplete="off" /><input type="hidden" name="authenticity_token" value="JjZraaz8kTMVOVoMWkeHgXhxjrKq-nbMxLVHHjZcHJF_FCP584_yIea9ezFXZuLQKI8DiuIR5hytup3qbF1zmg" />
        
      <details
      class="details-reset details-overlay position-relative"
      data-target="development-menu.details"
      data-action="click:development-menu#openSelectedRepoFromStorage"
      current-user="HiromiShikata"
      current-issue-or-pull-request-number="38"
      repo-nwo="HiromiShikata/test-repository"
      
    >
      <summary class="text-bold discussion-sidebar-heading discussion-sidebar-toggle"
              aria-haspopup="true"
              data-hotkey="x"
              data-menu-trigger="development-select-menu">
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-gear">
    <path d="M8 0a8.2 8.2 0 0 1 .701.031C9.444.095 9.99.645 10.16 1.29l.288 1.107c.018.066.079.158.212.224.231.114.454.243.668.386.123.082.233.09.299.071l1.103-.303c.644-.176 1.392.021 1.82.63.27.385.506.792.704 1.218.315.675.111 1.422-.364 1.891l-.814.806c-.049.048-.098.147-.088.294.016.257.016.515 0 .772-.01.147.038.246.088.294l.814.806c.475.469.679 1.216.364 1.891a7.977 7.977 0 0 1-.704 1.217c-.428.61-1.176.807-1.82.63l-1.102-.302c-.067-.019-.177-.011-.3.071a5.909 5.909 0 0 1-.668.386c-.133.066-.194.158-.211.224l-.29 1.106c-.168.646-.715 1.196-1.458 1.26a8.006 8.006 0 0 1-1.402 0c-.743-.064-1.289-.614-1.458-1.26l-.289-1.106c-.018-.066-.079-.158-.212-.224a5.738 5.738 0 0 1-.668-.386c-.123-.082-.233-.09-.299-.071l-1.103.303c-.644.176-1.392-.021-1.82-.63a8.12 8.12 0 0 1-.704-1.218c-.315-.675-.111-1.422.363-1.891l.815-.806c.05-.048.098-.147.088-.294a6.214 6.214 0 0 1 0-.772c.01-.147-.038-.246-.088-.294l-.815-.806C.635 6.045.431 5.298.746 4.623a7.92 7.92 0 0 1 .704-1.217c.428-.61 1.176-.807 1.82-.63l1.102.302c.067.019.177.011.3-.071.214-.143.437-.272.668-.386.133-.066.194-.158.211-.224l.29-1.106C6.009.645 6.556.095 7.299.03 7.53.01 7.764 0 8 0Zm-.571 1.525c-.036.003-.108.036-.137.146l-.289 1.105c-.147.561-.549.967-.998 1.189-.173.086-.34.183-.5.29-.417.278-.97.423-1.529.27l-1.103-.303c-.109-.03-.175.016-.195.045-.22.312-.412.644-.573.99-.014.031-.021.11.059.19l.815.806c.411.406.562.957.53 1.456a4.709 4.709 0 0 0 0 .582c.032.499-.119 1.05-.53 1.456l-.815.806c-.081.08-.073.159-.059.19.162.346.353.677.573.989.02.03.085.076.195.046l1.102-.303c.56-.153 1.113-.008 1.53.27.161.107.328.204.501.29.447.222.85.629.997 1.189l.289 1.105c.029.109.101.143.137.146a6.6 6.6 0 0 0 1.142 0c.036-.003.108-.036.137-.146l.289-1.105c.147-.561.549-.967.998-1.189.173-.086.34-.183.5-.29.417-.278.97-.423 1.529-.27l1.103.303c.109.029.175-.016.195-.045.22-.313.411-.644.573-.99.014-.031.021-.11-.059-.19l-.815-.806c-.411-.406-.562-.957-.53-1.456a4.709 4.709 0 0 0 0-.582c-.032-.499.119-1.05.53-1.456l.815-.806c.081-.08.073-.159.059-.19a6.464 6.464 0 0 0-.573-.989c-.02-.03-.085-.076-.195-.046l-1.102.303c-.56.153-1.113.008-1.53-.27a4.44 4.44 0 0 0-.501-.29c-.447-.222-.85-.629-.997-1.189l-.289-1.105c-.029-.11-.101-.143-.137-.146a6.6 6.6 0 0 0-1.142 0ZM11 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM9.5 8a1.5 1.5 0 1 0-3.001.001A1.5 1.5 0 0 0 9.5 8Z"></path>
</svg>
        Development
      </summary>

      <details-menu
        class="SelectMenu SelectMenu--hasFilter right-0 page-responsive"
        data-target="development-menu.repoMenu"
        data-action="click:development-menu#stopPropagation"
        aria-label="Repository menu"
        role="menu">
        <div class="SelectMenu-modal development-menu-component-menu-modal hx_rsm-modal-sm">
          <header class="SelectMenu-header">
            <h3 class="SelectMenu-title color-fg-default">
              Link a branch or pull request
              <span class="text-normal color-fg-muted d-block">
                Select a repository to search for branches and pull requests
                or
                  <button aria-label="Create a branch" data-action="click:create-branch#openDialog" type="button" data-view-component="true" class="btn-link">    create a branch
</button>
              </span>
            </h3>
            <button class="SelectMenu-closeButton top-0 right-0" type="button" data-action="click:development-menu#closeMenu">
              <svg aria-label="Close menu" role="img" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-x">
    <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path>
</svg>
            </button>
          </header>
          <div class="SelectMenu-filter">
            <remote-input
              aria-owns="development-menu-repository-list"
              param="repositories"
              src="/HiromiShikata/test-repository/issues/closing_references/referencing_repositories?source_id=2254985370&amp;source_type=ISSUE"
              data-action="
                remote-input-success:development-menu#repositoryListLoaded
                remote-input-error:development-menu#repositoryListLoadEnd
                loadstart:development-menu#repositoryListLoadStart
                loadend:development-menu#repositoryListLoadEnd
              ">
              <input
                type="text"
                class="SelectMenu-input form-control"
                placeholder="Search for repositories"
                data-target="development-menu.repoSearchInput"
                aria-label="Search for repositories"
                autocomplete="off"
                autofocus>
            </remote-input>
          </div>
          <div class="SelectMenu-list">
            <div class="SelectMenu-loading" data-target="development-menu.repositoryListSpinner">
              <svg style="box-sizing: content-box; color: var(--color-icon-primary);" width="32" height="32" viewBox="0 0 16 16" fill="none" data-view-component="true" class="anim-rotate">
  <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-opacity="0.25" stroke-width="2" vector-effect="non-scaling-stroke" fill="none" />
  <path d="M15 8a7.002 7.002 0 00-7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke" />
</svg>
            </div>
            <div data-target="development-menu.repositoryList" id="development-menu-repository-list"></div>
          </div>
        </div>
      </details-menu>
      <modal-dialog
        class="development-menu-component-dialog right-0 hx_rsm-modal-sm"
        data-target="development-menu.branchOrPullRequestDialog"
        data-action="click:development-menu#stopPropagation"
        aria-label="Branch or pull request dialog"
        
        hidden
      >
        <input
          type="text"
          name="repository_id"
          data-target="development-menu.selectedRepoIdInput"
          value=""
          hidden>
        <div class="SelectMenu-modal development-menu-component-dialog-modal">
          <div class="SelectMenu-header">
            <button class="SelectMenu-closeButton top-0 left-0 mr-2" type="button" data-action="click:development-menu#closeBranchOrPullRequestDialog">
              <svg aria-label="Back to repository menu" role="img" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-arrow-left">
    <path d="M7.78 12.53a.75.75 0 0 1-1.06 0L2.47 8.28a.75.75 0 0 1 0-1.06l4.25-4.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L4.81 7h7.44a.75.75 0 0 1 0 1.5H4.81l2.97 2.97a.75.75 0 0 1 0 1.06Z"></path>
</svg>
            </button>
            <h3 class="SelectMenu-title">
              <div class="color-fg-default line-clamp-1" data-target="development-menu.dialogTitle"></div>
              <span class="text-normal color-fg-muted">Link a branch, pull request, or
                  <button aria-label="create a branch" data-action="click:create-branch#openDialog" type="button" data-view-component="true" class="btn-link">    create a branch
</button>
              </span>
            </h3>
          </div>
          <div class="SelectMenu-filter">
            <remote-input
              aria-owns="development-menu-branch-and-pull-request-list"
              param="linkable_items"
              data-target="development-menu.branchAndPullRequestSearch"
              data-action="
                remote-input-success:development-menu#branchAndPullRequestListLoaded
                remote-input-error:development-menu#branchAndPullRequestListLoadEnd
                loadstart:development-menu#branchAndPullRequestListLoadStart
                loadend:development-menu#branchAndPullRequestListLoadEnd
              "
              src="">
              <input
                type="text"
                name="linkable_items"
                class="SelectMenu-input form-control"
                data-target="development-menu.branchAndPullRequestSearchInput"
                placeholder="Search for branches or pull requests"
                aria-label="Search for branches or pull requests"
                autocomplete="off"
                autofocus>
            </remote-input>
          </div>
          <div class="SelectMenu-list">
            <div class="SelectMenu-loading" data-target="development-menu.branchAndPullRequestListSpinner">
              <svg style="box-sizing: content-box; color: var(--color-icon-primary);" width="32" height="32" viewBox="0 0 16 16" fill="none" data-view-component="true" class="anim-rotate">
  <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-opacity="0.25" stroke-width="2" vector-effect="non-scaling-stroke" fill="none" />
  <path d="M15 8a7.002 7.002 0 00-7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke" />
</svg>
            </div>
            <div data-target="development-menu.branchAndPullRequestList" id="development-menu-branch-and-pull-request-list"></div>
          </div>
          <div class="SelectMenu-footer">
            <div class="d-flex flex-justify-start flex-row-reverse">
                <button aria-label="Apply" data-target="development-menu.applyButton" type="submit" disabled="disabled" data-view-component="true" class="btn-primary btn-sm btn ml-2">    Apply
</button>

                <button aria-label="Close" data-action="click:development-menu#resetForm" type="button" data-view-component="true" class="btn-sm btn">    Cancel
</button>
            </div>
          </div>
        </div>
      </modal-dialog>
      <div class="development-menu-component-dialog-overlay"></div>
    </details>



                <button data-action="click:create-branch#openDialog" type="button" data-view-component="true" class="btn-link">    Create a branch
</button>
    <span class="d-inline-block">for this issue or link a pull request.</span>





</form>    </development-menu>
  </div>
</div>

          <details
    hidden
    aria-hidden="true"
    data-target="create-branch.details"
    class="details-reset details-overlay details-overlay-dark lh-default color-fg-default">
    <summary role=""></summary>
    <details-dialog
      aria-label="Create a branch"
      class="Box Box--overlay overflow-visible d-flex flex-column anim-fade-in fast color-fg-default f5"
      data-action="details-dialog-close:create-branch#closeDialog"
      src= "/HiromiShikata/test-repository/issues/38/branch/new">

      <include-fragment>
        <svg style="box-sizing: content-box; color: var(--color-icon-primary);" width="32" height="32" viewBox="0 0 16 16" fill="none" data-view-component="true" class="my-3 mx-auto d-block anim-rotate">
  <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-opacity="0.25" stroke-width="2" vector-effect="non-scaling-stroke" fill="none" />
  <path d="M15 8a7.002 7.002 0 00-7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke" />
</svg>
      </include-fragment>
    </details-dialog>
  </details>

      </create-branch>

      <div class="discussion-sidebar-item sidebar-notifications">
      <include-fragment loading="lazy" src="/notifications/thread_subscription?repository_id=148233297&amp;thread_class=Issue&amp;thread_id=2254985370">
    <div data-hide-on-error>
        <svg style="box-sizing: content-box; color: var(--color-icon-primary);" width="32" height="32" viewBox="0 0 16 16" fill="none" data-view-component="true" class="mx-auto d-block anim-rotate">
  <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-opacity="0.25" stroke-width="2" vector-effect="non-scaling-stroke" fill="none" />
  <path d="M15 8a7.002 7.002 0 00-7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke" />
</svg>
    </div>
    <p data-show-on-error hidden>
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-alert mr-1">
    <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"></path>
</svg>
        Sorry, something went wrong and we weren't able to fetch your subscription status.
        <button data-retry-button="" type="button" data-view-component="true" class="Link--muted Button--link Button--medium Button">  <span class="Button-content">
    <span class="Button-label">Retry</span>
  </span>
</button>

    </p>
  </include-fragment>

  </div>


  
      <div id="partial-users-participants" class="discussion-sidebar-item">
  <div class="participation">
    <div class="discussion-sidebar-heading text-bold">
      1 participant
    </div>
    <div class="participation-avatars d-flex flex-wrap">
        <a class="participant-avatar" data-hovercard-type="user" data-hovercard-url="/users/HiromiShikata/hovercard" data-octo-click="hovercard-link-click" data-octo-dimensions="link_type:self" href="/HiromiShikata">
          <img class="avatar avatar-user" src="https://avatars.githubusercontent.com/u/6440811?s=52&amp;v=4" width="26" height="26" alt="@HiromiShikata" /> 
</a>    </div>
  </div>
</div>



    
  <div class="discussion-sidebar-item">
    <details class="details-reset details-overlay details-overlay-dark js-lock-issue">
      <summary class="btn-link no-underline text-bold Link--primary lock-toggle-link">
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-lock">
    <path d="M4 4a4 4 0 0 1 8 0v2h.25c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 12.25 15h-8.5A1.75 1.75 0 0 1 2 13.25v-5.5C2 6.784 2.784 6 3.75 6H4Zm8.25 3.5h-8.5a.25.25 0 0 0-.25.25v5.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-5.5a.25.25 0 0 0-.25-.25ZM10.5 6V4a2.5 2.5 0 1 0-5 0v2Z"></path>
</svg>
        <strong>Lock conversation</strong>
      </summary>
      <details-dialog class="anim-fade-in fast Box Box--overlay color-fg-default f5" aria-labelledby="lock-dialog-title">
        <!-- '"\` --><!-- </textarea></xmp> --></option></form><form data-turbo="false" action="/HiromiShikata/test-repository/issues/38/lock" accept-charset="UTF-8" method="post"><input type="hidden" name="_method" value="put" autocomplete="off" /><input type="hidden" name="authenticity_token" value="kg6ylmIa_EUAUjiO7s0LJ_wb1oOVy5ci_xrDr3SqSLiXH64Q3xeX4wi2q5u-eggR3ERLN9lAzFIu1PiYv6yhyg" />
          <div class="Box-header">
            <button class="Box-btn-octicon btn-octicon float-right" type="button" aria-label="Close dialog" data-close-dialog>
              <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-x">
    <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path>
</svg>
            </button>
            <h3 id="lock-dialog-title" class="Box-title">
              Lock conversation on this issue
            </h3>
          </div>
          <div class="Box-body">
            <ul class="ml-3">
                <li>Other users <strong>can’t add new comments</strong> to this issue.</li>
                  <li>
                    You and other collaborators
                    <a class="Link--inTextBlock" href="https://docs.github.com/articles/what-are-the-different-access-permissions">with access</a>
                    to this repository <strong>can still leave comments</strong> that others can see.
                  </li>
              <li>You can always unlock this issue again in the future.</li>
            </ul>

              <dl class="form-group mb-0">
                <dt>
                  <label for="unlock-reason">Reason for locking</label>
                </dt>
                <dd>
                <select name="reason" id="unlock-reason" aria-describedby="unlock-reason-note" class="form-select"><option value="">Choose a reason</option><option value="Off-topic">Off-topic</option>
<option value="Too heated">Too heated</option>
<option value="Resolved">Resolved</option>
<option value="Spam">Spam</option></select>
                  <p class="note" id="unlock-reason-note">
                    Optionally, choose a reason for locking that others can see. Learn more about when
                    it’s appropriate to <a class="Link--inTextBlock" href="https://docs.github.com/articles/locking-conversations">lock conversations</a>.
                  </p>
                </dd>
              </dl>
          </div>
          <div class="Box-footer">
              <button type="submit" data-view-component="true" class="btn btn-block">    Lock conversation on this issue
</button>          </div>
</form>      </details-dialog>
    </details>
  </div>


      <div class="discussion-sidebar-item border-top-0 mt-0">
      <!-- '"\` --><!-- </textarea></xmp> --></option></form><form class="d-inline" data-turbo="false" action="/HiromiShikata/test-repository/issues/38/pin" accept-charset="UTF-8" method="post"><input type="hidden" name="authenticity_token" value="UW1olMLnM_hVToscJaloHCMyxjwbAbOuwbI7qsl8AdRp4wM00pudml2K0QGqkqYbf4sd9stdb4Asyy4GQd-1Tw" />
        <button type="submit" class="btn-link text-bold Link--primary no-underline "  aria-label="Maximum 3 pinned issues">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-pin">
    <path d="m11.294.984 3.722 3.722a1.75 1.75 0 0 1-.504 2.826l-1.327.613a3.089 3.089 0 0 0-1.707 2.084l-.584 2.454c-.317 1.332-1.972 1.8-2.94.832L5.75 11.311 1.78 15.28a.749.749 0 1 1-1.06-1.06l3.969-3.97-2.204-2.204c-.968-.968-.5-2.623.832-2.94l2.454-.584a3.08 3.08 0 0 0 2.084-1.707l.613-1.327a1.75 1.75 0 0 1 2.826-.504ZM6.283 9.723l2.732 2.731a.25.25 0 0 0 .42-.119l.584-2.454a4.586 4.586 0 0 1 2.537-3.098l1.328-.613a.25.25 0 0 0 .072-.404l-3.722-3.722a.25.25 0 0 0-.404.072l-.613 1.328a4.584 4.584 0 0 1-3.098 2.537l-2.454.584a.25.25 0 0 0-.119.42l2.731 2.732Z"></path>
</svg>
          <strong>Pin issue</strong>
        </button>
        <span class="tooltipped tooltipped-s tooltipped-multiline" aria-label="Up to 3 issues can be pinned and they will appear publicly at the top of the issues page"> <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-info">
    <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path>
</svg> </span>
</form>  </div>



      <!-- '"\` --><!-- </textarea></xmp> --></option></form><form data-turbo="false" action="/HiromiShikata/test-repository/issues/38/transfer" accept-charset="UTF-8" method="post"><input type="hidden" name="authenticity_token" value="qHcddt7vJjyKbZk0A1WSVmyOwhy_saPRJVulxu3ePMoM1TDiAwK0sT7sQuGGoel8oLlMz4jCmamDK7iUCZefNQ" />
  <div class="discussion-sidebar-item border-top-0 mt-0">
    <details class="details-reset details-overlay details-overlay-dark js-transfer-issue">
      <summary class="btn-link no-underline text-bold Link--primary">
        <span class="text-bold Link--primary lock-toggle-link">
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-arrow-right">
    <path d="M8.22 2.97a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l2.97-2.97H3.75a.75.75 0 0 1 0-1.5h7.44L8.22 4.03a.75.75 0 0 1 0-1.06Z"></path>
</svg> <strong>Transfer issue</strong>
        </span>
      </summary>
      <details-dialog class="anim-fade-in fast Box Box--overlay color-fg-default f5 overflow-visible" aria-labelledby="transfer-dialog-title" src="/HiromiShikata/test-repository/issues/38/partials/transfer_form?issue=38" preload>
        <include-fragment>
          <svg style="box-sizing: content-box; color: var(--color-icon-primary);" width="32" height="32" viewBox="0 0 16 16" fill="none" data-view-component="true" class="my-3 mx-auto d-block anim-rotate">
  <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-opacity="0.25" stroke-width="2" vector-effect="non-scaling-stroke" fill="none" />
  <path d="M15 8a7.002 7.002 0 00-7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke" />
</svg>
        </include-fragment>
      </details-dialog>
    </details>
  </div>
</form>


    <div class="discussion-sidebar-item border-top-0 mt-0">
  <details class="details-reset details-overlay details-overlay-dark js-delete-issue">
    <summary class="d-inline-block">
      <span class="text-bold Link--primary lock-toggle-link">
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-trash">
    <path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.575l-.66-6.6a.75.75 0 1 1 1.492-.15ZM6.5 1.75V3h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25Z"></path>
</svg> <strong>Delete issue</strong>
      </span>
    </summary>
    <details-dialog class="anim-fade-in fast Box Box--overlay color-fg-default f5" aria-labelledby="delete-issue-dialog-title">
      <div class="Box-body p-3 text-center">
        <button class="Box-btn-octicon btn-octicon float-right" type="button" aria-label="Close dialog" data-close-dialog>
          <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-x">
    <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path>
</svg>
        </button>

        <svg height="40" width="40" aria-hidden="true" viewBox="0 0 24 24" version="1.1" data-view-component="true" class="octicon octicon-circle-slash color-fg-danger ml-1">
    <path d="M12 1c6.075 0 11 4.925 11 11s-4.925 11-11 11S1 18.075 1 12 5.925 1 12 1ZM5.834 19.227A9.464 9.464 0 0 0 12 21.5a9.5 9.5 0 0 0 9.5-9.5 9.464 9.464 0 0 0-2.273-6.166ZM2.5 12a9.464 9.464 0 0 0 2.273 6.166L18.166 4.773A9.463 9.463 0 0 0 12 2.5 9.5 9.5 0 0 0 2.5 12Z"></path>
</svg>

        <!-- '"\` --><!-- </textarea></xmp> --></option></form><form data-turbo="false" class="edit_issue" id="edit_issue_2254985370" action="/HiromiShikata/test-repository/issues/38" accept-charset="UTF-8" method="post"><input type="hidden" name="_method" value="delete" autocomplete="off" /><input type="hidden" name="authenticity_token" value="upd1DmaTvwqSmGPyogPZGmdnVNHMRAl_IF2g0b6FGo499gKELFS_UgWq6CdfoePFWuV5PJEkHkFBu-pUIFbihA" />
          <h4 class="mt-4">Are you sure you want to delete this issue?</h4>
          <div class="col-9 mx-auto mt-1 mb-4">
            <ul class="text-left">
              <li>This cannot be undone</li>
              <li>Only administrators can delete issues</li>
              <li>Deletion will remove the issue from search and previous references will point to a placeholder</li>
            </ul>
          </div>

          <button type="submit" name="verify_delete" value="1" class="btn btn-danger input-block float-none" data-disable-with="Deleting issue…">
            Delete this issue
          </button>
</form>      </div>
    </details-dialog>
  </details>
</div>


</div>

</div>
  
</div>          </div>
        </div>


    </div>


  </div>

</turbo-frame>


    </main>
  </div>

  </div>

          <footer class="footer pt-8 pb-6 f6 color-fg-muted p-responsive" role="contentinfo" >
  <h2 class='sr-only'>Footer</h2>

  


  <div class="d-flex flex-justify-center flex-items-center flex-column-reverse flex-lg-row flex-wrap flex-lg-nowrap">
    <div class="d-flex flex-items-center flex-shrink-0 mx-2">
      <a aria-label="Homepage" title="GitHub" class="footer-octicon mr-2" href="https://github.com">
        <svg aria-hidden="true" height="24" viewBox="0 0 16 16" version="1.1" width="24" data-view-component="true" class="octicon octicon-mark-github">
    <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"></path>
</svg>
</a>
      <span>
        &copy; 2024 GitHub,&nbsp;Inc.
      </span>
    </div>

    <nav aria-label="Footer">
      <h3 class="sr-only" id="sr-footer-heading">Footer navigation</h3>

      <ul class="list-style-none d-flex flex-justify-center flex-wrap mb-2 mb-lg-0" aria-labelledby="sr-footer-heading">

          <li class="mx-2">
            <a data-analytics-event="{&quot;category&quot;:&quot;Footer&quot;,&quot;action&quot;:&quot;go to Terms&quot;,&quot;label&quot;:&quot;text:terms&quot;}" href="https://docs.github.com/site-policy/github-terms/github-terms-of-service" data-view-component="true" class="Link--secondary Link">Terms</a>
          </li>

          <li class="mx-2">
            <a data-analytics-event="{&quot;category&quot;:&quot;Footer&quot;,&quot;action&quot;:&quot;go to privacy&quot;,&quot;label&quot;:&quot;text:privacy&quot;}" href="https://docs.github.com/site-policy/privacy-policies/github-privacy-statement" data-view-component="true" class="Link--secondary Link">Privacy</a>
          </li>

          <li class="mx-2">
            <a data-analytics-event="{&quot;category&quot;:&quot;Footer&quot;,&quot;action&quot;:&quot;go to security&quot;,&quot;label&quot;:&quot;text:security&quot;}" href="/security" data-view-component="true" class="Link--secondary Link">Security</a>
          </li>

          <li class="mx-2">
            <a data-analytics-event="{&quot;category&quot;:&quot;Footer&quot;,&quot;action&quot;:&quot;go to status&quot;,&quot;label&quot;:&quot;text:status&quot;}" href="https://www.githubstatus.com/" data-view-component="true" class="Link--secondary Link">Status</a>
          </li>

          <li class="mx-2">
            <a data-analytics-event="{&quot;category&quot;:&quot;Footer&quot;,&quot;action&quot;:&quot;go to docs&quot;,&quot;label&quot;:&quot;text:docs&quot;}" href="https://docs.github.com/" data-view-component="true" class="Link--secondary Link">Docs</a>
          </li>

          <li class="mx-2">
            <a data-analytics-event="{&quot;category&quot;:&quot;Footer&quot;,&quot;action&quot;:&quot;go to contact&quot;,&quot;label&quot;:&quot;text:contact&quot;}" href="https://support.github.com?tags=dotcom-footer" data-view-component="true" class="Link--secondary Link">Contact</a>
          </li>

          <li class="mr-3" >
  <cookie-consent-link>
    <button type="button" class="Link--secondary underline-on-hover border-0 p-0 color-bg-transparent" data-action="click:cookie-consent-link#showConsentManagement">
      Manage cookies
    </button>
  </cookie-consent-link>
</li>

<li class="mr-3">
  <cookie-consent-link>
    <button type="button" class="Link--secondary underline-on-hover border-0 p-0 color-bg-transparent" data-action="click:cookie-consent-link#showConsentManagement">
      Do not share my personal information
    </button>
  </cookie-consent-link>
</li>

      </ul>
    </nav>
  </div>
</footer>




    <ghcc-consent id="ghcc" class="position-fixed bottom-0 left-0" style="z-index: 999999" data-initial-cookie-consent-allowed="" data-cookie-consent-required="false"></ghcc-consent>


  <div id="ajax-error-message" class="ajax-error-message flash flash-error" hidden>
    <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-alert">
    <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"></path>
</svg>
    <button type="button" class="flash-close js-ajax-error-dismiss" aria-label="Dismiss error">
      <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-x">
    <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path>
</svg>
    </button>
    You can’t perform that action at this time.
  </div>

    <template id="site-details-dialog">
  <details class="details-reset details-overlay details-overlay-dark lh-default color-fg-default hx_rsm" open>
    <summary role="button" aria-label="Close dialog"></summary>
    <details-dialog class="Box Box--overlay d-flex flex-column anim-fade-in fast hx_rsm-dialog hx_rsm-modal">
      <button class="Box-btn-octicon m-0 btn-octicon position-absolute right-0 top-0" type="button" aria-label="Close dialog" data-close-dialog>
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-x">
    <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path>
</svg>
      </button>
      <div class="octocat-spinner my-6 js-details-dialog-spinner"></div>
    </details-dialog>
  </details>
</template>

    <div class="Popover js-hovercard-content position-absolute" style="display: none; outline: none;" tabindex="0">
  <div class="Popover-message Popover-message--bottom-left Popover-message--large Box color-shadow-large" style="width:360px;">
  </div>
</div>

    <template id="snippet-clipboard-copy-button">
  <div class="zeroclipboard-container position-absolute right-0 top-0">
    <clipboard-copy aria-label="Copy" class="ClipboardButton btn js-clipboard-copy m-2 p-0 tooltipped-no-delay" data-copy-feedback="Copied!" data-tooltip-direction="w">
      <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-copy js-clipboard-copy-icon m-2">
    <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"></path><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path>
</svg>
      <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-check js-clipboard-check-icon color-fg-success d-none m-2">
    <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path>
</svg>
    </clipboard-copy>
  </div>
</template>
<template id="snippet-clipboard-copy-button-unpositioned">
  <div class="zeroclipboard-container">
    <clipboard-copy aria-label="Copy" class="ClipboardButton btn btn-invisible js-clipboard-copy m-2 p-0 tooltipped-no-delay d-flex flex-justify-center flex-items-center" data-copy-feedback="Copied!" data-tooltip-direction="w">
      <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-copy js-clipboard-copy-icon">
    <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"></path><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path>
</svg>
      <svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" class="octicon octicon-check js-clipboard-check-icon color-fg-success d-none">
    <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path>
</svg>
    </clipboard-copy>
  </div>
</template>


    <style>
      .user-mention[href$="/HiromiShikata"] {
        color: var(--color-user-mention-fg);
        background-color: var(--bgColor-attention-muted, var(--color-attention-subtle));
        border-radius: 2px;
        margin-left: -2px;
        margin-right: -2px;
        padding: 0 2px;
      }
    </style>


    </div>

    <div id="js-global-screen-reader-notice" class="sr-only" aria-live="polite" aria-atomic="true" ></div>
    <div id="js-global-screen-reader-notice-assertive" class="sr-only" aria-live="assertive" aria-atomic="true"></div>
  </body>
</html>

`;
});
